-- Word Study — add pronunciation, Strong's number, and watch-moment link
-- so the expanded card can show: original script -> pronunciation -> Strong's # ->
-- lexicon meaning -> Watch moment (same youtube_url_with_timestamp pattern as declarations).

alter table sermon_word_studies
  add column if not exists pronunciation text,               -- phonetic guide, e.g. "sfrag-ID-zo"
  add column if not exists strongs_number text,               -- e.g. "G4972"
  add column if not exists timestamp_seconds int,              -- moment in the sermon this word was explained
  add column if not exists youtube_url_with_timestamp text;    -- https://youtube.com/watch?v=...&t=...s
