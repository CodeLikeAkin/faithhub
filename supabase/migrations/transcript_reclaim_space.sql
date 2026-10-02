-- Step 9 of moving transcripts out of the database (see
-- faithhub/docs/transcript-storage-migration-plan.md). Run AFTER step 8, which
-- cleared the column on 2026-10-02: all 724 transcripts are NULL in `sermons`
-- and present in the sermon-transcripts bucket.
--
-- Emptying the column marked the space reusable by Postgres but did not return
-- it. Until this runs the database reports the same size and the project stays
-- over its free-plan limit.
--
-- ⚠ RUN THE THREE PARTS SEPARATELY, NOT AS ONE SCRIPT.
--
-- The Supabase SQL editor wraps whatever you submit in a transaction, and
-- VACUUM cannot run inside a transaction block — submitting this file whole
-- fails with "25001: VACUUM cannot run inside a transaction block". Part 2 has
-- to be the only thing in the editor when you press run.
--
-- VACUUM FULL rewrites the table and takes an ACCESS EXCLUSIVE lock, so reads
-- and writes to `sermons` block while it runs. At roughly 80 MB that is about a
-- minute — unlike `sermon_segments` at 356 MB, where it would be a real outage.
-- Run it when the pipeline is idle. It rebuilds the table's indexes as part of
-- the rewrite, so no separate REINDEX is needed.
--
-- Expected: a drop of roughly 25-35 MB, NOT the ~78 MB the original plan
-- claimed. The raw text was 50.7 MB but Postgres compresses it about 2:1 in
-- TOAST storage, and `transcript_segments` — two thirds of this table's raw
-- bytes — is still here, deferred to its own migration.


-- ─── PART 1 — before. Run on its own. ──────────────────────────────────────

select pg_size_pretty(pg_database_size(current_database())) as database_before,
       pg_size_pretty(pg_total_relation_size('sermons'))    as sermons_before;


-- ─── PART 2 — the compaction. Run this line ALONE, nothing else. ───────────
-- If it still reports 25001, the editor is wrapping even a single statement;
-- use a direct database connection instead (see §9 of the plan document).

vacuum full sermons;


-- ─── PART 3 — after, plus a sanity check. Run on its own. ──────────────────
-- transcribed must still be 724 and still_holding_text must be 0. If either has
-- moved, stop and re-verify the storage copies before doing anything else.

analyze sermons;

select pg_size_pretty(pg_database_size(current_database())) as database_after,
       pg_size_pretty(pg_total_relation_size('sermons'))    as sermons_after;

select count(*) filter (where transcript_chars > 0)                        as transcribed,
       count(*) filter (where transcript is not null and transcript <> '') as still_holding_text
  from sermons;
