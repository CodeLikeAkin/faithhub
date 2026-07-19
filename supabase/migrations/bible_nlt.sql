-- NLT verse text (New Living Translation)
-- KJV verse text is served live from bible.helloao.org (translation id "eng_kjv") — see
-- lib/bible.js — and needs no table. NLT is Tyndale-copyrighted and isn't on that free API,
-- so it's bulk-loaded once from a local NLT XML export via
-- .claude/faithhub-pipeline/backfill-bible-nlt.js and served from this table instead.

create table if not exists bible_nlt (
  id       bigserial primary key,
  book_id  text not null,   -- USFM code, e.g. "GEN" — matches lib/bible.js bookIdFor()
  chapter  int  not null,
  verse    int  not null,
  text     text not null,
  unique (book_id, chapter, verse)
);

create index if not exists idx_bible_nlt_lookup on bible_nlt (book_id, chapter);

-- Public read (same posture as sermons/series/declarations); writes via service key only.
alter table bible_nlt enable row level security;

drop policy if exists "bible_nlt anon read" on bible_nlt;
create policy "bible_nlt anon read"
  on bible_nlt for select
  using (true);
