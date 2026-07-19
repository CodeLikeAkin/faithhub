-- match_segments_by_sermons
-- Semantic search over sermon_segments, filtered by a list of sermon IDs.
--
-- WHY: the older match_segments() filters on sermon_segments.series_id, but that
-- column is only partially populated (segments inserted before a sermon was
-- linked to a series got series_id = NULL). Filtering by sermon_id instead is
-- robust, because sermon_id is always set. The API passes the series' sermon_ids
-- (from series_sermons) so results are still scoped to the chosen series.
--
-- Run this once in the Supabase SQL editor. Safe to re-run (CREATE OR REPLACE).

create or replace function match_segments_by_sermons(
  query_embedding vector(384),
  filter_sermon_ids uuid[] default null,
  match_threshold float default 0.25,
  match_count int default 15
)
returns table (
  id uuid,
  sermon_id uuid,
  text text,
  start_seconds int,
  video_id text,
  sermon_title text,
  similarity float
)
language sql
stable
as $$
  -- filter_sermon_ids NULL = search the whole library (see hybrid_search.sql
  -- for why this matters more than it looks: a full-corpus id list is not a
  -- selective filter, just wasted per-row comparison work).
  select
    ss.id,
    ss.sermon_id,
    ss.text,
    ss.start_seconds,
    s.youtube_video_id as video_id,
    s.title            as sermon_title,
    1 - (ss.embedding <=> query_embedding) as similarity
  from sermon_segments ss
  join sermons s on s.id = ss.sermon_id
  where (filter_sermon_ids is null or ss.sermon_id = any(filter_sermon_ids))
    and ss.embedding is not null
    and 1 - (ss.embedding <=> query_embedding) > match_threshold
  order by ss.embedding <=> query_embedding
  limit match_count;
$$;
