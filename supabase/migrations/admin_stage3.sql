-- admin_stage3.sql
--
-- Admin console, part 3: the Publish step, the "no word studies needed" mark,
-- the Messages page and a whole-library careful pass.
--
-- Unlike stages 1 and 2, this adds two columns to an existing table (sermons).
-- Both are additive: every message that exists today comes out PUBLISHED, so
-- the live site looks exactly the same afterwards. Only messages added after
-- this runs start hidden, until you press Publish on the admin page.
-- Safe to run more than once.

-- ─── Publish step ───────────────────────────────────────────────────────────
-- Browse pages (home "Latest message", the series catalog, series and lesson
-- outlines) only list published messages. Ask the Word, Declarations and The
-- Word are not filtered, the same as messages outside a series today.
--
-- Adding the column with default TRUE marks every existing row published; the
-- default then flips to FALSE so new rows (pipeline, n8n worker) start hidden.

alter table sermons add column if not exists published boolean not null default true;
alter table sermons alter column published set default false;

comment on column sermons.published is
  'Listed on the browse pages (home, series). New rows start false; the admin console publishes them.';

-- ─── "No word studies needed" ──────────────────────────────────────────────
-- Many messages explain no Greek or Hebrew word at all. Once the admin has
-- checked one, it no longer counts as missing word studies.

alter table sermons add column if not exists word_studies_none boolean not null default false;

comment on column sermons.word_studies_none is
  'Checked on the admin page: this message explains no Greek or Hebrew word, so none are missing.';

-- Per-message declaration counts (Messages page). Other piece tables already
-- have a sermon_id index (hybrid_search.sql, sermon_scriptures.sql, ...).
create index if not exists declarations_sermon_id_idx on declarations (sermon_id);

-- ─── Overview numbers ──────────────────────────────────────────────────────
-- "Catalog" now means in a series AND published: what visitors can browse.

create or replace function admin_coverage()
returns jsonb
language sql
stable
as $$
  with catalog as (
    select distinct l.sermon_id as id
      from series_sermons l
      join sermons s on s.id = l.sermon_id
     where s.published
  )
  select jsonb_build_object(
    'sermons_total',             (select count(*) from sermons),
    'series_total',              (select count(*) from series),
    'catalog_sermons',           (select count(*) from catalog),
    'catalog_no_declarations',   (select count(*) from catalog c
                                   where not exists (select 1 from declarations d where d.sermon_id = c.id)),
    'catalog_no_scriptures',     (select count(*) from catalog c
                                   where not exists (select 1 from sermon_scriptures x where x.sermon_id = c.id)),
    'catalog_no_word_studies',   (select count(*) from catalog c
                                   join sermons s on s.id = c.id
                                   where not s.word_studies_none
                                     and not exists (select 1 from sermon_word_studies w where w.sermon_id = c.id)),
    'catalog_word_studies_none', (select count(*) from catalog c
                                   join sermons s on s.id = c.id
                                   where s.word_studies_none
                                     and not exists (select 1 from sermon_word_studies w where w.sermon_id = c.id)),
    'catalog_no_notes',          (select count(*) from catalog c
                                   join sermons s on s.id = c.id
                                   where s.study_notes is null),
    'dead_videos_total',         (select count(*) from sermons where video_status in ('private', 'deleted')),
    'dead_videos_in_catalog',    (select count(*) from catalog c
                                   join sermons s on s.id = c.id
                                   where s.video_status in ('private', 'deleted')),
    'videos_unchecked',          (select count(*) from sermons where video_status is null),
    'unpublished',               (select count(*) from sermons where not published),
    'unpublished_in_series',     (select count(distinct l.sermon_id) from series_sermons l
                                   join sermons s on s.id = l.sermon_id
                                   where not s.published),
    'jobs_queued',               (select count(*) from admin_jobs where status = 'queued'),
    'jobs_running',              (select count(*) from admin_jobs where status = 'running')
  );
$$;

create or replace function admin_segment_gaps()
returns int
language sql
stable
as $$
  select count(*)::int
    from (select distinct l.sermon_id as id
            from series_sermons l
            join sermons s on s.id = l.sermon_id
           where s.published) c
   where not exists (select 1 from sermon_segments g where g.sermon_id = c.id);
$$;

-- ─── Careful pass, optionally across the whole library ─────────────────────
-- Series messages (published or not) and anything processed from the admin
-- page, as before; with p_library => true, every other message missing
-- declarations too. Study notes are only wanted for messages in a series.
-- The return shape grows, so the old version is dropped first.

drop function if exists admin_careful_pass();

create or replace function admin_careful_pass(p_library boolean default false)
returns table (
  id                 uuid,
  title              text,
  youtube_video_id   text,
  sermon_date        text,
  series_title       text,
  part_number        int,
  in_catalog         boolean,
  needs_declarations boolean,
  needs_notes        boolean,
  has_transcript     boolean,
  published          boolean,
  added_here         boolean,
  video_status       text
)
language sql
stable
as $$
  with added as (
    select distinct j.sermon_id as sid
      from admin_jobs j
     where j.sermon_id is not null and j.status = 'done'
  ),
  candidates as (
    select distinct l.sermon_id as sid from series_sermons l
    union
    select a.sid from added a
    union
    select s.id from sermons s where p_library
  ),
  gathered as (
    select s.id as sid,
           s.title::text as stitle,
           s.youtube_video_id::text as vid,
           s.sermon_date::text as sdate,
           se.title::text as setitle,
           lk.part_number::int as part,
           (lk.sermon_id is not null) as catalog,
           not exists (select 1 from declarations d where d.sermon_id = s.id) as no_decl,
           coalesce(length(btrim(s.study_notes)), 0) = 0 as no_notes,
           -- octet_length reads the stored size without unpacking the transcript.
           coalesce(octet_length(s.transcript), 0) > 0 as has_tx,
           s.published as pub,
           exists (select 1 from added a where a.sid = s.id) as here,
           s.video_status::text as vstatus
      from candidates c
      join sermons s on s.id = c.sid
      left join lateral (
        select x.series_id, x.sermon_id, x.part_number
          from series_sermons x
         where x.sermon_id = s.id
         order by x.part_number
         limit 1
      ) lk on true
      left join series se on se.id = lk.series_id
  )
  select r.sid, r.stitle, r.vid, r.sdate, r.setitle, r.part, r.catalog,
         r.no_decl, r.catalog and r.no_notes, r.has_tx, r.pub, r.here, r.vstatus
    from gathered r
   where r.no_decl or (r.catalog and r.no_notes)
   order by r.sdate desc nulls last;
$$;

-- ─── Messages page: every message with its pieces ──────────────────────────
-- One JSON array (not a row set, so PostgREST's 1,000-row cap never trims it).

create or replace function admin_messages()
returns jsonb
language sql
stable
as $$
  with lnk as (
    select distinct on (l.sermon_id)
           l.sermon_id, l.series_id, l.part_number, se.title as series_title,
           count(*) over (partition by l.sermon_id) as links
      from series_sermons l
      join series se on se.id = l.series_id
     order by l.sermon_id, l.part_number
  ),
  scr as (select sermon_id, count(*)::int as n from sermon_scriptures group by sermon_id),
  wds as (select sermon_id, count(*)::int as n from sermon_word_studies group by sermon_id),
  dcl as (select sermon_id, count(*)::int as n from declarations group by sermon_id),
  job as (
    select distinct on (j.youtube_video_id) j.youtube_video_id, j.status, j.created_at
      from admin_jobs j
     order by j.youtube_video_id, j.created_at desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',                s.id,
           'title',             s.title,
           'youtube_video_id',  s.youtube_video_id,
           'sermon_date',       s.sermon_date,
           'created_at',        s.created_at,
           'video_status',      s.video_status,
           'published',         s.published,
           'word_studies_none', s.word_studies_none,
           'series_id',         lnk.series_id,
           'series_title',      lnk.series_title,
           'part_number',       lnk.part_number,
           'series_links',      coalesce(lnk.links, 0),
           'transcript',        coalesce(octet_length(s.transcript), 0) > 0,
           'search',            exists (select 1 from sermon_segments g where g.sermon_id = s.id),
           'scriptures',        coalesce(scr.n, 0),
           'word_studies',      coalesce(wds.n, 0),
           'declarations',      coalesce(dcl.n, 0),
           'notes',             coalesce(length(btrim(s.study_notes)), 0) > 0,
           'job_status',        job.status,
           'job_at',            job.created_at
         ) order by s.sermon_date desc nulls last, s.created_at desc), '[]'::jsonb)
    from sermons s
    left join lnk on lnk.sermon_id = s.id
    left join scr on scr.sermon_id = s.id
    left join wds on wds.sermon_id = s.id
    left join dcl on dcl.sermon_id = s.id
    left join job on job.youtube_video_id = s.youtube_video_id;
$$;

-- ─── Series page: how many parts are waiting to be published ───────────────

create or replace function admin_series_overview()
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(to_jsonb(t) order by t.latest desc nulls last), '[]'::jsonb)
    from (
      select se.id,
             se.title,
             se.start_date,
             se.end_date,
             se.total_parts,
             (se.study_summary is not null) as has_summary,
             count(l.sermon_id)::int as parts,
             count(l.sermon_id) filter (where exists (select 1 from sermon_segments g where g.sermon_id = l.sermon_id))::int as with_search,
             count(l.sermon_id) filter (where exists (select 1 from sermon_scriptures x where x.sermon_id = l.sermon_id))::int as with_scriptures,
             count(l.sermon_id) filter (where exists (select 1 from declarations d where d.sermon_id = l.sermon_id))::int as with_declarations,
             count(l.sermon_id) filter (where coalesce(length(btrim(s.study_notes)), 0) > 0)::int as with_notes,
             count(l.sermon_id) filter (where s.video_status in ('private', 'deleted'))::int as dead_videos,
             count(l.sermon_id) filter (where not s.published)::int as unpublished,
             max(s.sermon_date) as latest,
             (array_agg(s.youtube_video_id order by l.part_number) filter (where s.youtube_video_id is not null))[1:3] as thumbs
        from series se
        left join series_sermons l on l.series_id = se.id
        left join sermons s on s.id = l.sermon_id
       group by se.id
    ) t;
$$;

revoke all on function admin_coverage()                 from public, anon, authenticated;
revoke all on function admin_segment_gaps()             from public, anon, authenticated;
revoke all on function admin_careful_pass(boolean)      from public, anon, authenticated;
revoke all on function admin_messages()                 from public, anon, authenticated;
revoke all on function admin_series_overview()          from public, anon, authenticated;
grant execute on function admin_coverage()              to service_role;
grant execute on function admin_segment_gaps()          to service_role;
grant execute on function admin_careful_pass(boolean)   to service_role;
grant execute on function admin_messages()              to service_role;
grant execute on function admin_series_overview()       to service_role;

-- Let the API see the new columns and functions straight away.
notify pgrst, 'reload schema';
