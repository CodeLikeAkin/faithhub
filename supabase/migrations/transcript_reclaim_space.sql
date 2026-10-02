-- Step 9 of moving transcripts out of the database (see
-- faithhub/docs/transcript-storage-migration-plan.md). Run AFTER step 8 has
-- cleared the column — which it has, as of 2026-10-02: all 724 transcripts are
-- NULL in `sermons` and present in the sermon-transcripts bucket.
--
-- Emptying the column marked the space reusable by Postgres but did not return
-- it. Until this runs, the database reports the same size as before and the
-- project stays over its free-plan limit. This is the step that shrinks it.
--
-- VACUUM FULL rewrites the table and takes an ACCESS EXCLUSIVE lock, so reads
-- and writes to `sermons` block while it runs. At roughly 80 MB that is about a
-- minute — unlike `sermon_segments` at 356 MB, where the same operation would
-- be a real outage. Run it when the pipeline is idle.
--
-- It also needs free disk equal to the rewritten table, which is not a concern
-- at this size.
--
-- Expected: a drop of roughly 25-35 MB, NOT the ~78 MB the original plan
-- claimed. The raw text was 50.7 MB but Postgres compresses it about 2:1 in
-- TOAST storage, and `transcript_segments` — two thirds of this table's raw
-- bytes — is still here, deferred to its own migration.

-- Before.
select pg_size_pretty(pg_database_size(current_database())) as database_before,
       pg_size_pretty(pg_total_relation_size('sermons'))    as sermons_before;

vacuum full sermons;

-- Reclaims the indexes too; cheap once the table has been rewritten.
reindex table sermons;

-- Refresh the planner's statistics for the rewritten table.
analyze sermons;

-- After.
select pg_size_pretty(pg_database_size(current_database())) as database_after,
       pg_size_pretty(pg_total_relation_size('sermons'))    as sermons_after;

-- Sanity: must still be 724 / 0. If transcript_chars has moved, something is
-- wrong and the storage copies should be re-verified before going further.
select count(*) filter (where transcript_chars > 0)                    as transcribed,
       count(*) filter (where transcript is not null and transcript <> '') as still_holding_text
  from sermons;
