-- Step 4 of moving transcripts out of the database (see
-- faithhub/docs/transcript-storage-migration-plan.md). Run after
-- transcript_chars.sql.
--
-- Transcripts move to a PRIVATE bucket at sermon-transcripts/<sermon id>.txt.
-- Private with no storage policies means the public anon key can neither read
-- nor write them; only the pipeline's service key can. That matters here more
-- than for feedback screenshots: the transcripts are the sermon corpus, and
-- the live site has no reason to fetch one.
--
-- CLAUDE.md rule 1 still stands — never send a full transcript to an LLM, only
-- sermon_segments. Moving the text to storage does not make it cheap to read at
-- request time, and must not become a reason to start doing so.
--
-- 2 MB per object: the largest transcript measured 2026-10-02 is well under
-- 400 KB, so this is a backstop against a runaway transcribe, not a real limit.
-- text/plain only, since that is all the pipeline writes.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sermon-transcripts',
  'sermon-transcripts',
  false,
  2097152,
  array['text/plain']
)
on conflict (id) do nothing;
