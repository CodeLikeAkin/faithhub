-- The Word / Verse Explorer
-- One row per distinct scripture reference a sermon cites.
-- No timestamps: we only capture WHICH scriptures were opened, in order.
-- Powers both the per-sermon Verse Explorer and the reverse index.

create table if not exists sermon_scriptures (
  id           uuid primary key default gen_random_uuid(),
  sermon_id    uuid not null references sermons(id) on delete cascade,
  book         text not null,             -- canonical name, e.g. "Hebrews"
  book_id      text,                      -- USFM code for the Bible API, e.g. "HEB"
  chapter      int  not null,
  verse_start  int,
  verse_end    int,                       -- null when a single verse or whole chapter
  reference    text not null,             -- display string, e.g. "Hebrews 6:19"
  theme        text,                      -- short human label, optional
  order_index  int  default 0,            -- order the pastor opened it in the message
  created_at   timestamptz default now(),
  unique (sermon_id, reference)
);

create index if not exists idx_sermon_scriptures_sermon on sermon_scriptures (sermon_id);
-- reverse index: "which sermons open this passage?"
create index if not exists idx_sermon_scriptures_book on sermon_scriptures (book_id, chapter);

-- Public read (same posture as sermons/series/declarations); writes via service key only.
alter table sermon_scriptures enable row level security;

drop policy if exists "sermon_scriptures anon read" on sermon_scriptures;
create policy "sermon_scriptures anon read"
  on sermon_scriptures for select
  using (true);
