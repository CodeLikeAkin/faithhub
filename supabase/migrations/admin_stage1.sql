-- admin_stage1.sql
--
-- Tables and functions for the admin console (stage 1). Everything here is NEW:
-- no existing table, column, index or policy is altered.
--
-- Access model: RLS is switched ON for every table with NO policies, so the
-- public anon key can neither read nor write them. Only the service role (the
-- server-side /api/admin routes and the pipeline worker run by n8n) can.
--
-- Safe to run more than once.

-- ─── Job queue ─────────────────────────────────────────────────────────────
-- The admin page inserts a row; the worker on the PC claims it, runs the
-- existing pipeline for that sermon and writes progress back.

create table if not exists admin_jobs (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null default 'process_sermon'
                     check (kind in ('process_sermon')),
  status           text not null default 'queued'
                     check (status in ('queued', 'running', 'done', 'failed', 'cancelled')),
  youtube_video_id text not null,
  sermon_id        uuid references sermons(id) on delete set null,
  -- What the admin confirmed before queueing, e.g.
  -- {"series_id": "...", "part_number": 4} or {"new_series": {"title": "..."}}
  payload          jsonb not null default '{}'::jsonb,
  -- Final per-sermon checklist written by the worker when it finishes.
  result           jsonb,
  error            text,
  attempts         int not null default 0,
  created_at       timestamptz not null default now(),
  started_at       timestamptz,
  heartbeat_at     timestamptz,
  finished_at      timestamptz
);

-- One live job per video: pasting the same link twice can't double-process it.
create unique index if not exists admin_jobs_one_active_per_video
  on admin_jobs (youtube_video_id)
  where status in ('queued', 'running');

create index if not exists admin_jobs_status_created
  on admin_jobs (status, created_at);

-- Progress lines shown under a running job.
create table if not exists admin_job_events (
  id      bigint generated always as identity primary key,
  job_id  uuid not null references admin_jobs(id) on delete cascade,
  at      timestamptz not null default now(),
  level   text not null default 'info' check (level in ('info', 'warn', 'error')),
  stage   text,
  message text not null
);

create index if not exists admin_job_events_job on admin_job_events (job_id, id);

-- "New on YouTube" list. The nightly n8n check fills it; nothing in here is
-- processed until the admin ticks it.
create table if not exists admin_candidates (
  youtube_video_id text primary key,
  title            text not null,
  published_at     timestamptz,
  duration_seconds int,
  status           text not null default 'new'
                     check (status in ('new', 'queued', 'dismissed')),
  first_seen_at    timestamptz not null default now()
);

-- Single-row heartbeat so the page can say "processing computer last seen 2 min ago".
create table if not exists admin_worker (
  id           int primary key default 1 check (id = 1),
  last_seen_at timestamptz,
  note         text
);

alter table admin_jobs        enable row level security;
alter table admin_job_events  enable row level security;
alter table admin_candidates  enable row level security;
alter table admin_worker      enable row level security;

-- ─── Claim the next job (used by the worker) ───────────────────────────────
-- Atomic and single-flight: never starts a second job while one is genuinely
-- running, and fails a job whose worker went silent (PC slept, crashed).

create or replace function admin_claim_job(stale_minutes int default 20)
returns setof admin_jobs
language plpgsql
as $$
declare
  j admin_jobs;
begin
  -- Serialise concurrent claims (n8n can fire overlapping executions).
  perform pg_advisory_xact_lock(74151);

  update admin_jobs
     set status = 'failed',
         error = 'The processing computer stopped responding',
         finished_at = now()
   where status = 'running'
     and coalesce(heartbeat_at, started_at) < now() - make_interval(mins => stale_minutes);

  if exists (select 1 from admin_jobs where status = 'running') then
    return;
  end if;

  update admin_jobs
     set status = 'running',
         started_at = now(),
         heartbeat_at = now(),
         attempts = attempts + 1
   where id = (
           select id from admin_jobs
            where status = 'queued'
            order by created_at
            limit 1
            for update skip locked
         )
  returning * into j;

  if found then
    return next j;
  end if;
  return;
end;
$$;

revoke all on function admin_claim_job(int) from public, anon, authenticated;
grant execute on function admin_claim_job(int) to service_role;

-- ─── Overview numbers (used by the admin Overview page) ────────────────────
-- "Catalog" = sermons linked into a series, i.e. what the public app browses.

create or replace function admin_coverage()
returns jsonb
language sql
stable
as $$
  with catalog as (select distinct sermon_id as id from series_sermons)
  select jsonb_build_object(
    'sermons_total',           (select count(*) from sermons),
    'series_total',            (select count(*) from series),
    'catalog_sermons',         (select count(*) from catalog),
    'catalog_no_declarations', (select count(*) from catalog c
                                 where not exists (select 1 from declarations d where d.sermon_id = c.id)),
    'catalog_no_scriptures',   (select count(*) from catalog c
                                 where not exists (select 1 from sermon_scriptures x where x.sermon_id = c.id)),
    'catalog_no_word_studies', (select count(*) from catalog c
                                 where not exists (select 1 from sermon_word_studies w where w.sermon_id = c.id)),
    'catalog_no_notes',        (select count(*) from catalog c
                                 join sermons s on s.id = c.id
                                 where s.study_notes is null),
    'dead_videos_total',       (select count(*) from sermons where video_status in ('private', 'deleted')),
    'dead_videos_in_catalog',  (select count(*) from catalog c
                                 join sermons s on s.id = c.id
                                 where s.video_status in ('private', 'deleted')),
    'videos_unchecked',        (select count(*) from sermons where video_status is null),
    'jobs_queued',             (select count(*) from admin_jobs where status = 'queued'),
    'jobs_running',            (select count(*) from admin_jobs where status = 'running')
  );
$$;

-- Kept separate: sermon_segments is the biggest table, so if this one is slow
-- on the free tier it can fail alone without blanking the whole Overview.
create or replace function admin_segment_gaps()
returns int
language sql
stable
as $$
  select count(*)::int
    from (select distinct sermon_id as id from series_sermons) c
   where not exists (select 1 from sermon_segments g where g.sermon_id = c.id);
$$;

revoke all on function admin_coverage()     from public, anon, authenticated;
revoke all on function admin_segment_gaps() from public, anon, authenticated;
grant execute on function admin_coverage()     to service_role;
grant execute on function admin_segment_gaps() to service_role;
