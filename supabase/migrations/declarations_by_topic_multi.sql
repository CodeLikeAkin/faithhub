-- declarations_by_topic_multi.sql
-- Widens match_declarations_by_topic from a single topic to an array of
-- topics, so the Declarations page can combine chips (e.g. Finances + Fear)
-- into one mixed, randomly-ordered pool instead of one topic at a time.
-- Matching stays an overlap (@> becomes &&): a declaration qualifies if it
-- carries ANY of the selected tags, not all of them.
--
-- Run this once in the Supabase SQL editor. Safe to re-run (idempotent).
-- Drops the old single-topic signature since the API route no longer calls it.

drop function if exists match_declarations_by_topic(text, int, uuid[]);

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
    and not (d.id = any(exclude_ids))
  order by random()
  limit match_count;
$$;
