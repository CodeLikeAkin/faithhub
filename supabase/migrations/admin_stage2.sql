-- admin_stage2.sql
--
-- Admin console, part 2: change history + read-only helper functions for the
-- Add sermons, Careful pass, Series and Review pages. Everything is NEW; no
-- existing table, column, index or policy is altered. Safe to run more than once.
-- Same access model as admin_stage1.sql: RLS on, no policies, service role only.

-- ─── Change history ────────────────────────────────────────────────────────
-- Every edit made from the admin console is recorded with what it looked like
-- before and after, so any change can be checked and put back by hand.

create table if not exists admin_audit (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  action    text not null,          -- e.g. 'declaration.update', 'series.rename'
  entity    text not null,          -- 'declaration', 'series', 'sermon', ...
  entity_id text,
  summary   text not null,          -- plain-English line shown in History
  before    jsonb,
  after     jsonb
);

create index if not exists admin_audit_at on admin_audit (at desc);
alter table admin_audit enable row level security;

-- ─── Which study pieces a set of sermons has ───────────────────────────────

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
         coalesce(length(s.transcript), 0) > 0,
         exists (select 1 from sermon_segments g where g.sermon_id = s.id),
         exists (select 1 from sermon_scriptures x where x.sermon_id = s.id),
         exists (select 1 from sermon_word_studies w where w.sermon_id = s.id),
         (select count(*)::int from declarations d where d.sermon_id = s.id),
         coalesce(length(btrim(s.study_notes)), 0) > 0
    from sermons s
   where s.id = any (p_ids);
$$;

-- ─── The careful-pass to-do list ───────────────────────────────────────────
-- Catalog sermons (and anything processed from the admin page) that still need
-- declarations, or, for catalog sermons, study notes.

create or replace function admin_careful_pass()
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
  has_transcript     boolean
)
language sql
stable
as $$
  with candidates as (
    select distinct l.sermon_id as sid from series_sermons l
    union
    select distinct j.sermon_id from admin_jobs j where j.sermon_id is not null and j.status = 'done'
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
           coalesce(length(s.transcript), 0) > 0 as has_tx
      from candidates c
      join sermons s on s.id = c.sid
      left join lateral (
        select x.series_id, x.sermon_id, x.part_number
          from series_sermons x
         where x.sermon_id = s.id
         limit 1
      ) lk on true
      left join series se on se.id = lk.series_id
  )
  select r.sid, r.stitle, r.vid, r.sdate, r.setitle, r.part, r.catalog,
         r.no_decl, r.catalog and r.no_notes, r.has_tx
    from gathered r
   where r.no_decl or (r.catalog and r.no_notes)
   order by r.sdate desc nulls last;
$$;

-- ─── One summary row per series (Series page) ──────────────────────────────

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
             max(s.sermon_date) as latest,
             (array_agg(s.youtube_video_id order by l.part_number) filter (where s.youtube_video_id is not null))[1:3] as thumbs
        from series se
        left join series_sermons l on l.series_id = se.id
        left join sermons s on s.id = l.sermon_id
       group by se.id
    ) t;
$$;

revoke all on function admin_sermon_pieces(uuid[]) from public, anon, authenticated;
revoke all on function admin_careful_pass()        from public, anon, authenticated;
revoke all on function admin_series_overview()     from public, anon, authenticated;
grant execute on function admin_sermon_pieces(uuid[]) to service_role;
grant execute on function admin_careful_pass()        to service_role;
grant execute on function admin_series_overview()     to service_role;
