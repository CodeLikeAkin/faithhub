-- Word Study — Greek/Hebrew word explanations
-- One row per original-language word Rev. Ayoalabi explicitly explains in a sermon
-- (e.g. "the Greek word here is 'agape', which means...").
-- Powers a Word Study section on the sermon page, rendered only when rows exist.

create table if not exists sermon_word_studies (
  id              uuid primary key default gen_random_uuid(),
  sermon_id       uuid not null references sermons(id) on delete cascade,
  word            text not null,             -- transliterated word, e.g. "agape"
  language        text not null check (language in ('greek', 'hebrew', 'aramaic')),
  original_script text,                      -- native script if given, e.g. "ἀγάπη"
  meaning         text not null,             -- the explanation as given in the sermon
  reference       text,                      -- scripture reference tied to the word, if any
  note            text,                      -- flags where the pastor's meaning diverges from standard lexicons, or transcription is uncertain
  order_index     int default 0,             -- order explained in the message
  created_at      timestamptz default now(),
  unique (sermon_id, word, language)
);

create index if not exists idx_sermon_word_studies_sermon on sermon_word_studies (sermon_id);

-- Public read (same posture as sermons/declarations/sermon_scriptures), writes via service key only.
alter table sermon_word_studies enable row level security;

drop policy if exists "sermon_word_studies anon read" on sermon_word_studies;
create policy "sermon_word_studies anon read"
  on sermon_word_studies for select
  using (true);
