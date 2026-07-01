-- Vector (ANN) indexes for fast semantic search.
--
-- WHY: without an index, pgvector does an exact scan of EVERY row for each
-- query. That's fine at a few thousand rows but slows down as sermon_segments
-- grows (tens of thousands of chunks). An HNSW index makes similarity search
-- fast and roughly constant-time.
--
-- WHEN: run this AFTER the re-chunk backfill finishes — building the index on
-- the final data is faster than maintaining it during a large insert.
--
-- Both tables use cosine distance (the <=> operator) on normalized gte-small
-- embeddings, so we use vector_cosine_ops.
--
-- Requires pgvector >= 0.5.0 (Supabase has this). If HNSW is unavailable on an
-- older version, use the ivfflat fallback at the bottom instead.

create index if not exists sermon_segments_embedding_hnsw
  on sermon_segments
  using hnsw (embedding vector_cosine_ops);

create index if not exists declarations_embedding_hnsw
  on declarations
  using hnsw (embedding vector_cosine_ops);

-- Helps the sermon_id filter in match_segments_by_sermons.
create index if not exists sermon_segments_sermon_id_idx
  on sermon_segments (sermon_id);

-- ── ivfflat fallback (only if HNSW errors on an older pgvector) ──
-- create index if not exists sermon_segments_embedding_ivf
--   on sermon_segments using ivfflat (embedding vector_cosine_ops) with (lists = 100);
-- create index if not exists declarations_embedding_ivf
--   on declarations using ivfflat (embedding vector_cosine_ops) with (lists = 100);
