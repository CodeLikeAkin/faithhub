-- admin_declarations_none.sql
--
-- Admin console: declarations are counted the way the Declarations page sees
-- them, and a message can be marked "no declarations needed".
--
-- Before this, every admin count asked only "does this message have any
-- declaration rows?". That disagreed with the public site both ways:
--   * a guest's message whose declarations are all kept off the library
--     (declarations.in_library = false) showed "44 declarations, in place",
--     though the Declarations page shows none of them;
--   * a message nobody meant to give declarations (40 Days of Transformation
--     sessions, guests outside a series) showed as missing, with no way to say
--     "checked, none needed" — word studies had that mark, declarations didn't.
--
-- Now, per message:
--   declarations       rows the Declarations page can show (in_library)
--   declarations_kept  rows kept off it (guests, celebration / panel videos);
--                      they still show on that message's own page
--   declarations_none  checked on the admin page: none needed
-- and a message only "needs declarations" when it has no rows of either kind
-- and isn't marked none needed.
--
-- Each function below is its current definition (admin_stage3.sql, or
-- admin_transcript_chars.sql where that replaced it) with only the
-- declaration test changed. Run once in the Supabase SQL editor; safe to
-- re-run. Additive: the new column defaults to false, so nothing is marked
-- until the admin (or the one-off back-fill) marks it.

-- ─── The mark ──────────────────────────────────────────────────────────────

alter table sermons add column if not exists declarations_none boolean not null default false;

comment on column sermons.declarations_none is
  'Checked on the admin page: this message needs no declarations (e.g. a 40 Days of Transformation session, or a guest outside a series), so none are missing.';

-- ─── Overview numbers ──────────────────────────────────────────────────────

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
                                   join sermons s on s.id = c.id
                                   where not s.declarations_none
                                     and not exists (select 1 from declarations d where d.sermon_id = c.id)),
    'catalog_declarations_none', (select count(*) from catalog c
                                   join sermons s on s.id = c.id
                                   where s.declarations_none
                                     and not exists (select 1 from declarations d where d.sermon_id = c.id)),
    'catalog_declarations_kept', (select count(*) from catalog c
                                   where exists (select 1 from declarations d where d.sermon_id = c.id)
                                     and not exists (select 1 from declarations d where d.sermon_id = c.id and d.in_library)),
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

-- ─── Careful pass: skip messages marked none needed ────────────────────────

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
           not s.declarations_none
             and not exists (select 1 from declarations d where d.sermon_id = s.id) as no_decl,
           coalesce(length(btrim(s.study_notes)), 0) = 0 as no_notes,
           -- The marker column, so this stays true once the text has moved out.
           coalesce(s.transcript_chars, 0) > 0 as has_tx,
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

-- ─── Messages page ─────────────────────────────────────────────────────────

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
  dcl as (
    select sermon_id,
           (count(*) filter (where in_library))::int     as n,
           (count(*) filter (where not in_library))::int as kept
      from declarations
     group by sermon_id
  ),
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
           'declarations_none', s.declarations_none,
           'series_id',         lnk.series_id,
           'series_title',      lnk.series_title,
           'part_number',       lnk.part_number,
           'series_links',      coalesce(lnk.links, 0),
           'transcript',        coalesce(s.transcript_chars, 0) > 0,
           'search',            exists (select 1 from sermon_segments g where g.sermon_id = s.id),
           'scriptures',        coalesce(scr.n, 0),
           'word_studies',      coalesce(wds.n, 0),
           'declarations',      coalesce(dcl.n, 0),
           'declarations_kept', coalesce(dcl.kept, 0),
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

-- ─── Per-message pieces (series editor) ────────────────────────────────────
-- The return shape grows, so the old version is dropped first.

drop function if exists admin_sermon_pieces(uuid[]);

create function admin_sermon_pieces(p_ids uuid[])
returns table (
  sermon_id         uuid,
  transcript        boolean,
  segments          boolean,
  scriptures        boolean,
  word_studies      boolean,
  declarations      int,
  declarations_kept int,
  declarations_none boolean,
  notes             boolean
)
language sql
stable
as $$
  select s.id,
         coalesce(s.transcript_chars, 0) > 0,
         exists (select 1 from sermon_segments g where g.sermon_id = s.id),
         exists (select 1 from sermon_scriptures x where x.sermon_id = s.id),
         exists (select 1 from sermon_word_studies w where w.sermon_id = s.id),
         (select count(*)::int from declarations d where d.sermon_id = s.id and d.in_library),
         (select count(*)::int from declarations d where d.sermon_id = s.id and not d.in_library),
         s.declarations_none,
         coalesce(length(btrim(s.study_notes)), 0) > 0
    from sermons s
   where s.id = any (p_ids);
$$;

-- ─── Series page ───────────────────────────────────────────────────────────

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
             count(l.sermon_id) filter (where s.declarations_none
                                           or exists (select 1 from declarations d where d.sermon_id = l.sermon_id))::int as with_declarations,
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

revoke all on function admin_coverage()                from public, anon, authenticated;
revoke all on function admin_careful_pass(boolean)     from public, anon, authenticated;
revoke all on function admin_messages()                from public, anon, authenticated;
revoke all on function admin_sermon_pieces(uuid[])     from public, anon, authenticated;
revoke all on function admin_series_overview()         from public, anon, authenticated;
grant execute on function admin_coverage()             to service_role;
grant execute on function admin_careful_pass(boolean)  to service_role;
grant execute on function admin_messages()             to service_role;
grant execute on function admin_sermon_pieces(uuid[])  to service_role;
grant execute on function admin_series_overview()      to service_role;

-- Let the API see the new column and functions straight away.
notify pgrst, 'reload schema';
