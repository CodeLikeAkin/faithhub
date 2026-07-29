-- The Word / chapter view — add a watch-moment link so each verse mention
-- can jump straight to where it's opened in the sermon, instead of the
-- whole video. Same pattern as sermon_word_studies_watch_moment.sql.

alter table sermon_scriptures
  add column if not exists timestamp_seconds int,              -- moment in the sermon this verse was opened
  add column if not exists youtube_url_with_timestamp text;     -- https://youtube.com/watch?v=...&t=...s
