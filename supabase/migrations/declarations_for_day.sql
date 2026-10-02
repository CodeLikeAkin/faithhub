-- declarations_for_day.sql
-- The Declarations page's daily set: 8 good declarations for one theme, the
-- same 8 for everyone on a given day, a different 8 the next day, and no
-- repeats until the theme's whole pool has been shown.
--
-- Still a FILTER over the topic_tags taxonomy, not retrieval (CLAUDE.md rule
-- 2): no embedding, no LLM. The page chooses which theme leads each day; this
-- picks that day's 8 for whichever theme is open.
--
-- How the rotation works: every theme's pool is put in one fixed shuffled
-- order (md5 of id + theme), and day N reads the 8 starting at N × 8, wrapping
-- round at the end. Fear (~300 declarations) cycles in about five weeks;
-- Faith (~3,300) in over a year.
--
-- "Good" — the quality rules (option A; an AI grade per declaration, option B,
-- can replace them later):
--   * 15–170 characters: long enough to mean something, short enough to say aloud
--   * spoken over yourself: has I / me / my / we / us / our in it
--   * not a thank-you prayer ("Thank You, Father, for…")
--   * linked to its moment in the video
--   * from a published message
--   * near-duplicates (same words, different punctuation) count once
--
-- Run this once in the Supabase SQL editor. Safe to re-run (idempotent).
-- Until it exists, the page falls back to a plain rotation without the rules.

create or replace function declarations_for_day(
  topic text,
  day_number int,
  match_count int default 8
)
returns table (
  id uuid,
  declaration_text text,
  youtube_url_with_timestamp text,
  sermon_id uuid,
  sermon_title text
)
language sql
stable
as $$
  with base as (
    select distinct on (lower(regexp_replace(d.declaration_text, '[^a-zA-Z ]', '', 'g')))
           d.id,
           d.declaration_text,
           d.youtube_url_with_timestamp,
           d.sermon_id,
           coalesce(sm.title, 'Heritage of Faith Church') as sermon_title
    from declarations d
    left join sermons sm on sm.id = d.sermon_id
    where d.topic_tags @> array[topic]
      and char_length(btrim(d.declaration_text)) between 15 and 170
      and d.declaration_text ~* '\m(i|me|my|mine|myself|we|us|our|ours)\M'
      and d.declaration_text !~* '^\s*thank(s| you)'
      and coalesce(d.youtube_url_with_timestamp, '') <> ''
      and coalesce(sm.published, true)
    order by lower(regexp_replace(d.declaration_text, '[^a-zA-Z ]', '', 'g')), d.id
  ),
  pool as (
    select b.*,
           row_number() over (order by md5(b.id::text || topic)) - 1 as rn,
           count(*) over () as n
    from base b
  )
  select p.id, p.declaration_text, p.youtube_url_with_timestamp, p.sermon_id, p.sermon_title
  from pool p
  where ((p.rn - (day_number::bigint * match_count) % p.n) + p.n) % p.n < match_count
  order by ((p.rn - (day_number::bigint * match_count) % p.n) + p.n) % p.n;
$$;

grant execute on function declarations_for_day(text, int, int) to anon, authenticated;
