-- 20260724122000_fix_scoped_hybrid_search.sql
--
-- RETRIEVAL FIX (pre-launch audit, blocker #2).
--
-- Problem: series/sermon-scoped Study Chat returned 0 segments for most
-- questions, so the UI told users the series "isn't indexed yet" even though
-- every series is fully embedded. Root cause was HNSW ANN post-filtering: the
-- semantic leg did `ORDER BY embedding <=> q LIMIT 60` and only THEN applied the
-- sermon filter, so scoping to 2 sermons (~0.25% of all segments) left almost
-- nothing. `/ask` (global, unfiltered) was unaffected.
--
-- Fix: split the semantic leg by scope.
--   • Global (filter is NULL)  → keep the fast HNSW index scan (Ask the Word).
--   • Scoped (filter present)  → exact nearest-neighbour over ONLY the scoped
--     sermons, via a MATERIALIZED CTE. Materializing applies the sermon filter
--     BEFORE the distance sort, which prevents the planner from taking the
--     index's global top-K and post-filtering it away. A scope is a handful of
--     sermons (tens–hundreds of segments), so an exact scan is cheap and, unlike
--     ANN, guaranteed to see every candidate in scope.
--
-- The two branches are mutually exclusive (guarded on filter_sermon_ids IS
-- [NOT] NULL), so exactly one runs per call and the other is a one-time-false
-- no-op with no table scan. Keyword leg and RRF fusion are unchanged.

drop function if exists _audit_pgvector_info();

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
  with q as (
    select case
             when coalesce(query_text, '') = '' then null
             else websearch_to_tsquery('english', query_text)
           end as ts
  ),
  -- Scoped candidates: exact distance over ONLY the filtered sermons.
  -- MATERIALIZED is load-bearing — it forces the sermon filter to be applied
  -- before the ORDER BY, defeating the HNSW global-top-K post-filter problem.
  -- Empty (one-time-false, no scan) whenever filter_sermon_ids is null.
  filtered_semantic as materialized (
    select ss.id, (ss.embedding <=> query_embedding) as dist
    from sermon_segments ss
    where filter_sermon_ids is not null
      and ss.sermon_id = any(filter_sermon_ids)
      and ss.embedding is not null
      and query_embedding is not null
  ),
  semantic as (
    -- Global path: HNSW index scan (fast, unfiltered).
    (
      select ss.id,
             row_number() over (order by ss.embedding <=> query_embedding) as rank,
             1 - (ss.embedding <=> query_embedding) as vec_sim
      from sermon_segments ss
      where filter_sermon_ids is null
        and ss.embedding is not null
        and query_embedding is not null
      order by ss.embedding <=> query_embedding
      limit 60
    )

    union all

    -- Scoped path: exact nearest within scope.
    (
      select fs.id,
             row_number() over (order by fs.dist) as rank,
             1 - fs.dist as vec_sim
      from filtered_semantic fs
      order by fs.dist
      limit 60
    )
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
