-- hybrid_search.sql
-- Hybrid retrieval = semantic (pgvector) + keyword (Postgres full-text), fused
-- with Reciprocal Rank Fusion (RRF).
--
-- WHY: gte-small is a small 384-dim model. It is semantically decent but blind
-- to exact tokens — scripture references ("Habakkuk 3:17"), names, and coined
-- phrases can be missed by pure vector search. For a product whose promise is
-- "Rev. Peter's exact words", keyword recall matters. RRF blends both rankings
-- without needing to tune a weight between two different score scales.
--
-- RRF score for a row = sum over each ranker of 1 / (rrf_k + rank_in_that_ranker).
-- A row that ranks well in EITHER search scores high; ranking well in BOTH wins.
--
-- Run this once in the Supabase SQL editor. Safe to re-run (idempotent).
-- Requires: pgvector (already present) and Postgres FTS (built in).

-- ─────────────────────────────────────────────────────────────
-- 0. One-time timeout guard.
--    Adding a STORED generated column (section 1) REWRITES each table, which
--    forces every index — including the HNSW vector index — to be rebuilt.
--    That rebuild can exceed the editor's default statement_timeout (error
--    57014). Raise it for this one-time migration. (Session-scoped; harmless.)
-- ─────────────────────────────────────────────────────────────
set statement_timeout = '15min';

-- ─────────────────────────────────────────────────────────────
-- 1. Full-text search columns (generated + GIN indexed)
-- ─────────────────────────────────────────────────────────────
alter table sermon_segments
  add column if not exists fts tsvector
  generated always as (to_tsvector('english', coalesce(text, ''))) stored;

create index if not exists sermon_segments_fts_idx
  on sermon_segments using gin (fts);

alter table declarations
  add column if not exists fts tsvector
  generated always as (to_tsvector('english', coalesce(declaration_text, ''))) stored;

create index if not exists declarations_fts_idx
  on declarations using gin (fts);

-- Helps the initial sermon_id narrowing in the segment function.
create index if not exists sermon_segments_sermon_id_idx
  on sermon_segments (sermon_id);

-- ─────────────────────────────────────────────────────────────
-- 2. Hybrid segment search, scoped to a series' sermon_ids.
--    query_embedding MAY be null — if the embed service is down, the function
--    degrades to keyword-only rather than returning nothing.
--
--    PERF NOTES:
--    - The tsquery is computed ONCE in CTE `q` and reused (avoids recomputing
--      websearch_to_tsquery in both the filter and the rank).
--    - query_embedding is referenced DIRECTLY (not via a joined CTE column) so
--      the planner can still use the HNSW index for the ORDER BY … <=> … LIMIT.
-- ─────────────────────────────────────────────────────────────
-- Return row shape changed (added vec_similarity), so CREATE OR REPLACE alone
-- is rejected by Postgres (42P13) — the old signature must be dropped first.
drop function if exists match_segments_hybrid(vector, text, uuid[], integer, integer);

create or replace function match_segments_hybrid(
  query_embedding vector(384),
  query_text text,
  filter_sermon_ids uuid[] default null,
  match_count int default 40,
  rrf_k int default 50
)
returns table (
  id uuid,
  sermon_id uuid,
  text text,
  start_seconds int,
  video_id text,
  sermon_title text,
  similarity float,
  vec_similarity float
)
language sql
stable
as $$
  -- filter_sermon_ids may be NULL, meaning "search the whole library" (used by
  -- the global Ask the Word endpoint). NULL is treated as "no filter" rather
  -- than passing every sermon id, so the planner can run a clean top-K index
  -- scan instead of evaluating a several-hundred-element array match on every
  -- row for a filter that wouldn't have excluded anything anyway.
  --
  -- `similarity` is the RRF fused score — good for RANKING (blends keyword +
  -- semantic recall) but it's a positional score (1/(rrf_k+rank)), so it's
  -- nonzero and similarly-shaped for EVERY query, including off-topic or
  -- gibberish ones — there is always a "rank 1". It must never be read as
  -- "how relevant is this". `vec_similarity` is the actual cosine similarity
  -- (1 - cosine distance) from the semantic leg, which the API can threshold
  -- against to decide whether anything is genuinely grounded (see
  -- match_segments_by_sermons.sql's 0.25 convention). Callers matched only by
  -- keyword (not in the semantic top-60) get vec_similarity = 0.
  with q as (
    select case
             when coalesce(query_text, '') = '' then null
             else websearch_to_tsquery('english', query_text)
           end as ts
  ),
  semantic as (
    select ss.id,
           row_number() over (order by ss.embedding <=> query_embedding) as rank,
           1 - (ss.embedding <=> query_embedding) as vec_sim
    from sermon_segments ss
    where (filter_sermon_ids is null or ss.sermon_id = any(filter_sermon_ids))
      and ss.embedding is not null
      and query_embedding is not null
    order by ss.embedding <=> query_embedding
    limit 60
  ),
  keyword as (
    select ss.id,
           row_number() over (order by ts_rank_cd(ss.fts, q.ts) desc) as rank
    from sermon_segments ss, q
    where (filter_sermon_ids is null or ss.sermon_id = any(filter_sermon_ids))
      and q.ts is not null
      and ss.fts @@ q.ts
    limit 60
  ),
  fused as (
    select coalesce(s.id, k.id) as id,
           coalesce(1.0 / (rrf_k + s.rank), 0.0)
             + coalesce(1.0 / (rrf_k + k.rank), 0.0) as score,
           coalesce(s.vec_sim, 0.0) as vec_sim
    from semantic s
    full outer join keyword k on s.id = k.id
  )
  select ss.id,
         ss.sermon_id,
         ss.text,
         ss.start_seconds,
         s.youtube_video_id as video_id,
         s.title            as sermon_title,
         f.score            as similarity,
         f.vec_sim          as vec_similarity
  from fused f
  join sermon_segments ss on ss.id = f.id
  join sermons s on s.id = ss.sermon_id
  order by f.score desc
  limit match_count;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. Hybrid declaration search (semantic + keyword), with exclude_ids for
--    "show me more" pagination. Same RRF blend and perf shape as above.
-- ─────────────────────────────────────────────────────────────
create or replace function match_declarations_hybrid(
  query_embedding vector(384),
  query_text text,
  match_count int default 30,
  exclude_ids uuid[] default '{}',
  rrf_k int default 50
)
returns table (
  id uuid,
  declaration_text text,
  youtube_url_with_timestamp text,
  topic_tags text[],
  sermon_title text,
  similarity float
)
language sql
stable
as $$
  with q as (
    select case
             when coalesce(query_text, '') = '' then null
             else websearch_to_tsquery('english', query_text)
           end as ts
  ),
  semantic as (
    select d.id,
           row_number() over (order by d.embedding <=> query_embedding) as rank
    from declarations d
    where d.embedding is not null
      and query_embedding is not null
      and not (d.id = any(exclude_ids))
    order by d.embedding <=> query_embedding
    limit 60
  ),
  keyword as (
    select d.id,
           row_number() over (order by ts_rank_cd(d.fts, q.ts) desc) as rank
    from declarations d, q
    where q.ts is not null
      and d.fts @@ q.ts
      and not (d.id = any(exclude_ids))
    limit 60
  ),
  fused as (
    select coalesce(s.id, k.id) as id,
           coalesce(1.0 / (rrf_k + s.rank), 0.0)
             + coalesce(1.0 / (rrf_k + k.rank), 0.0) as score
    from semantic s
    full outer join keyword k on s.id = k.id
  )
  select d.id,
         d.declaration_text,
         d.youtube_url_with_timestamp,
         d.topic_tags,
         coalesce(sm.title, 'Heritage of Faith Church') as sermon_title,
         f.score as similarity
  from fused f
  join declarations d on d.id = f.id
  left join sermons sm on sm.id = d.sermon_id
  order by f.score desc
  limit match_count;
$$;
