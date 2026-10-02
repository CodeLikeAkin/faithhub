-- Reclaim ~95 MB by removing redundant ANN indexes. Found and run 2026-10-02,
-- while chasing the free-plan size limit after the transcript migration
-- recovered only 33 MB. This recovered nearly three times that, from one
-- statement each.
--
-- No data is touched. An index is derived from its table, so a drop is
-- reversible by recreating it; the only cost of being wrong is rebuild time.
-- Neither statement affects the embeddings themselves, so CLAUDE.md rule 3 is
-- untouched — only the structures over them change.

-- ─── 1. sermon_segments — a true duplicate. 82 MB. ─────────────────────────
--
-- The table carried TWO indexes with identical definitions:
--
--   sermon_segments_embedding_hnsw  USING hnsw (embedding vector_cosine_ops)  82 MB  206 scans
--   sermon_segments_embedding_idx   USING hnsw (embedding vector_cosine_ops)  82 MB  350 scans
--
-- Same method, same column, same operator class. The planner used both only
-- because either would serve; the survivor answers every query exactly as
-- before, and inserts stop paying to maintain two copies.
--
-- The undocumented name is the one dropped: vector_indexes.sql creates
-- *_embedding_hnsw with `if not exists`, so keeping that name leaves the repo
-- and the database in agreement and stops a future run recreating the
-- duplicate.

drop index if exists public.sermon_segments_embedding_idx;

-- ─── 2. declarations — ivfflat retired in favour of HNSW. ~13 MB. ──────────
--
--   declarations_embedding_idx   USING ivfflat  13 MB  924 scans
--   declarations_embedding_hnsw  USING hnsw     14 MB    0 scans
--
-- Different methods, so this was a choice rather than a cleanup, and it was
-- checked before acting: the HNSW index reported indisvalid = true and
-- indisready = true, so its zero scans were the planner's cost model
-- preferring ivfflat, not a failed build. Had it been invalid, the correct
-- move would have been the opposite — drop the broken HNSW index and keep the
-- ivfflat one actually serving queries.
--
-- Dropping ivfflat is also expected to IMPROVE declarations search. An ivfflat
-- index created without `lists` and queried with the default `probes = 1`
-- scans a single list per query, so recall is poor and genuinely relevant
-- declarations can be missed. HNSW has no equivalent failure mode, and it is
-- what vector_indexes.sql intends.
--
-- The declarations topic grid is unaffected either way: browsing a fixed
-- taxonomy is a tag filter on topic_tags, not vector retrieval (CLAUDE.md
-- rule 2). Test a FREEFORM declarations query to exercise this path.

drop index if exists public.declarations_embedding_idx;

-- DROP INDEX returns the space immediately; no VACUUM FULL needed. Confirm:
--   select pg_size_pretty(pg_database_size(current_database()));
