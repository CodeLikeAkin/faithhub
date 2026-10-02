-- Step 3 of moving transcripts out of the database (see
-- faithhub/docs/transcript-storage-migration-plan.md). Run after
-- transcript_chars.sql.
--
-- Three admin RPCs decide "has this sermon been transcribed?" from the
-- transcript column itself. Once step 8 clears it they would all report false
-- and the admin console would show the whole library as unprocessed.
--
-- Each function below is its current definition verbatim, with only the
-- transcript test changed:
--
--   coalesce(octet_length(s.transcript), 0) > 0  ->  coalesce(s.transcript_chars, 0) > 0
--
-- Two sibling checks in lib/admin-dashboard.js were also quietly wrong before
-- this migration, because the column is never null — 17 rows hold an empty
-- string. It counted .not(transcript, is, null) and so reported 741 of 741
-- transcribed when the true figure is 724, and its "published with no
-- transcript" check used .is(transcript, null), which matches nothing and could
-- never fire. Both are fixed in that file. The RPCs below already used
-- length() > 0 and were correct; they only need to read the new column.

-- admin_sermon_pieces — from admin_stage2.sql
create or replace function admin_sermon_pieces(p_ids uuid[])
returns table (
  sermon_id    uuid,
  transcript   boolean,
  segments     boolean,
  scriptures   boolean,
  word_studies boolean,
  declarations int,
  notes        boolean
)
language sql
stable
as $$
  select s.id,
         coalesce(s.transcript_chars, 0) > 0,
         exists (select 1 from sermon_segments g where g.sermon_id = s.id),
         exists (select 1 from sermon_scriptures x where x.sermon_id = s.id),
         exists (select 1 from sermon_word_studies w where w.sermon_id = s.id),
         (select count(*)::int from declarations d where d.sermon_id = s.id),
         coalesce(length(btrim(s.study_notes)), 0) > 0
    from sermons s
   where s.id = any (p_ids);
$$;

-- admin_careful_pass — from admin_stage3.sql
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

-- admin_messages — from admin_stage3.sql
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
           'transcript',        coalesce(s.transcript_chars, 0) > 0,
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
