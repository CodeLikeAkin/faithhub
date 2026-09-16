-- declarations_by_topic.sql
-- Topic-grid browsing (Faith / Finances / Fear / etc. on the Declarations page)
-- is NOT freeform retrieval — it's a filter over a fixed, already-populated
-- taxonomy (`declarations.topic_tags`). Routing it through the embed+hybrid
-- RPC capped recall at a ~30-row semantic candidate pool and returned the
-- SAME rows every single visit (deterministic embedding => deterministic
-- ranking). Finances alone has 311 tagged declarations but the hybrid RPC
-- surfaced only 4, because most prosperity language ("I have increased",
-- "overflowing") doesn't literally contain "financ*" and isn't close enough
-- in the small 384-dim embedding space to the query "declarations about
-- finances". This function goes straight to the tag column instead.
--
-- Run this once in the Supabase SQL editor. Safe to re-run (idempotent).

create or replace function match_declarations_by_topic(
  topic text,
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
  where d.topic_tags @> array[topic]
    and not (d.id = any(exclude_ids))
  order by random()
  limit match_count;
$$;
