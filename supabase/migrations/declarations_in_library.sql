-- declarations_in_library.sql
--
-- Declarations come from Dad and Mom. Guest ministers' and celebration /
-- panel videos' declarations stay out of the declaarations LIBRARY — the topic
-- grid, the theme pages, the daily set, the Today card and "What are you
-- facing?".
--
-- They are NOT deleted and NOT hidden everywhere: a guest's own message page
-- and its series page still show that message's declarations beside its notes
-- and scriptures, because you opened that message deliberately. Those two
-- surfaces read `declarations` by sermon_id (components/lesson/useSeriesBundle.js)
-- and simply don't apply this filter.
--
-- WHY A COLUMN. The first cut of this worked out who preached at request time:
-- read all 741 sermon titles, regex every ministerial name, collect the ~31
-- guest/panel sermons, look up their declarations. Measured 0.95-2.3s on every
-- cold request, in front of a chain that was deliberately parallelised. But
-- "is this declaration a library declaration?" is a fact about the row that
-- never changes — so it is stored once and read as one condition.
--
-- Run this once in the Supabase SQL editor. Safe to re-run (idempotent).
-- AFTER running it, back-fill the existing rows:
--     node scripts/backfill-in-library.js --dry-run
--     node scripts/backfill-in-library.js
-- The back-fill is done in JS, not here, so it uses lib/speakers.js — the one
-- authoritative copy of the guest/panel rules — instead of a second
-- translation of those regexes into SQL that could drift from it.
--
-- No index: 275 of 6,906 rows are false, so a filter on it costs nothing the
-- planner cares about, and this database has been trimmed for space before.

-- ── 1. The column ────────────────────────────────────────────────────────────
-- Default true: every existing row, and anything inserted without an opinion,
-- is a library declaration. Only the back-fill and the pipeline say otherwise.

alter table declarations
  add column if not exists in_library boolean not null default true;

comment on column declarations.in_library is
  'False for guest ministers and celebration/panel videos: kept out of the declarations library (topic grid, daily set, Today card, "What are you facing?") but still shown on that message''s own page. Set by scripts/backfill-in-library.js and by the pipeline on save.';

-- ── 2. The topic grid ────────────────────────────────────────────────────────

create or replace function match_declarations_by_topic(
  topics text[],
  match_count int default 10,
  exclude_ids uuid[] default '{}'
)
returns table (
  id uuid,
  declaration_text text,
  youtube_url_with_timestamp text,
  topic_tags text[],
  sermon_title text
)
language sql
stable
as $$
  select d.id,
         d.declaration_text,
         d.youtube_url_with_timestamp,
         d.topic_tags,
         coalesce(sm.title, 'Heritage of Faith Church') as sermon_title
  from declarations d
  left join sermons sm on sm.id = d.sermon_id
  where d.topic_tags && topics
    and d.in_library
    and not (d.id = any(exclude_ids))
  order by random()
  limit match_count;
$$;

-- ── 3. The daily set ─────────────────────────────────────────────────────────
-- Unchanged except for `and d.in_library`. The rotation is deliberately NOT
-- reseeded: it runs over whatever the pool is, so dropping the guests' rows
-- just makes each theme's pool a little smaller. A day's set is now a full
-- `match_count` again — before this, the filter ran after the RPC and a day
-- whose picks included a guest's came up a card short.

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
      and d.in_library
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

-- ── 4. "What are you facing?" ────────────────────────────────────────────────
-- Both legs of the RRF fuse are filtered, so a guest's declaration can never
-- enter the candidate pool from either side. Unchanged otherwise.

create or replace function match_declarations_hybrid(
  query_embedding vector(384),
  query_text text,
  match_count int default 30,
  exclude_ids uuid[] default '{}',
  rrf_k int default 50
)
returns table (
  id uuid,
  declaration_text text,
  youtube_url_with_timestamp text,
  topic_tags text[],
  sermon_title text,
  similarity float
)
language sql
stable
as $$
  with q as (
    select case
             when coalesce(query_text, '') = '' then null
             else websearch_to_tsquery('english', query_text)
           end as ts
  ),
  semantic as (
    select d.id,
           row_number() over (order by d.embedding <=> query_embedding) as rank
    from declarations d
    where d.embedding is not null
      and query_embedding is not null
      and d.in_library
      and not (d.id = any(exclude_ids))
    order by d.embedding <=> query_embedding
    limit 60
  ),
  keyword as (
    select d.id,
           row_number() over (order by ts_rank_cd(d.fts, q.ts) desc) as rank
    from declarations d, q
    where q.ts is not null
      and d.fts @@ q.ts
      and d.in_library
      and not (d.id = any(exclude_ids))
    limit 60
  ),
  fused as (
    select coalesce(s.id, k.id) as id,
           coalesce(1.0 / (rrf_k + s.rank), 0.0)
             + coalesce(1.0 / (rrf_k + k.rank), 0.0) as score
    from semantic s
    full outer join keyword k on s.id = k.id
  )
  select d.id,
         d.declaration_text,
         d.youtube_url_with_timestamp,
         d.topic_tags,
         coalesce(sm.title, 'Heritage of Faith Church') as sermon_title,
         f.score as similarity
  from fused f
  join declarations d on d.id = f.id
  left join sermons sm on sm.id = d.sermon_id
  order by f.score desc
  limit match_count;
$$;

-- ── 5. match_declarations (the vector-only fallback) ─────────────────────────
-- NOT changed here. That function was created straight in the SQL editor and
-- its definition is not in this repo, so there is nothing safe to
-- `create or replace` from. It only runs when match_declarations_hybrid itself
-- errors, and app/api/declarations/route.js filters its handful of rows on
-- in_library instead. To move that filter into SQL too, run
--     select pg_get_functiondef('match_declarations'::regproc);
-- paste the result into this file, add `and d.in_library`, and drop the
-- route-side filter.
