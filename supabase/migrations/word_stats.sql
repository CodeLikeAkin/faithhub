-- The Word — reverse-index aggregate stats.
-- Powers the scripture heat-map: how many references + distinct sermons per book.
-- OPTIONAL: the /word page falls back to client-side aggregation if this RPC
-- isn't present, so applying this is purely a performance upgrade (one grouped
-- query instead of paging the whole table to the browser).

create or replace function word_book_stats()
returns table (
  book_id      text,
  book         text,
  ref_count    bigint,
  sermon_count bigint
)
language sql
stable
as $$
  select
    coalesce(book_id, '')          as book_id,
    max(book)                      as book,
    count(*)::bigint               as ref_count,
    count(distinct sermon_id)::bigint as sermon_count
  from sermon_scriptures
  group by coalesce(book_id, '')
$$;

grant execute on function word_book_stats() to anon, authenticated;
