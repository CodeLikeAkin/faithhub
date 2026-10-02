-- Step 2 of moving transcripts out of the database (see
-- faithhub/docs/transcript-storage-migration-plan.md).
--
-- 23 filters across 9 files answer "has this sermon been transcribed?" by
-- testing the transcript column itself:
--
--   .not('transcript', 'is', null).neq('transcript', '')
--
-- Once the column is emptied, every one of those reports that NO sermon has a
-- transcript — the pipeline would skip everything or re-transcribe all 741
-- sermons from YouTube, and the admin readiness dashboard would show the whole
-- library as unprocessed.
--
-- transcript_chars is the marker those filters move to instead
-- (.gt('transcript_chars', 0)). It is 4 bytes per row — about 3 KB for the
-- whole table — and it survives the column being cleared. Adding and
-- backfilling it changes no behaviour: it mirrors what the filters already
-- compute. Safe to run and leave for days before anything is deleted.
--
-- No index. The table is 741 rows, so a presence check is a trivial scan, and
-- the database is over its free-plan size limit — an index here would spend
-- the space this migration exists to reclaim.
--
-- Measured 2026-10-02: 724 of 741 rows carry a transcript; 17 have none.

alter table sermons
  add column if not exists transcript_chars int;

comment on column sermons.transcript_chars is
  'Character count of transcript, or 0 when there is none. Survives the '
  'transcript column being moved to file storage, so presence checks read '
  'this rather than the text. Written by the pipeline on transcribe.';

-- Backfilled in batches of 50. length(transcript) has to pull every
-- transcript out of TOAST storage, and doing all 741 in one statement risks
-- the free tier's statement timeout — an exact count(*) on this table has
-- already been seen to hit it. 50 rows is roughly 3.5 MB of text per pass.
do $$
declare
  touched int;
begin
  loop
    update sermons s
       set transcript_chars = coalesce(length(s.transcript), 0)
     where s.id in (
       select id from sermons where transcript_chars is null limit 50
     );
    get diagnostics touched = row_count;
    exit when touched = 0;
  end loop;
end $$;

-- Expect: 741 total, 724 with_text, 17 without, max 0 still null.
select count(*)                                          as total,
       count(*) filter (where transcript_chars > 0)       as with_text,
       count(*) filter (where transcript_chars = 0)       as without,
       count(*) filter (where transcript_chars is null)   as still_null
  from sermons;
