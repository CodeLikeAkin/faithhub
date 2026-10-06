-- The Word / one book — chapter counts, top passages, and the messages that
-- open it, aggregated in Postgres instead of in the browser.
--
-- Before this, /word/<book> downloaded every reference row for the book with
-- its sermon joined in (416 KB for Ephesians, 649 KB for Psalms) over two
-- sequential 1000-row pages, then did the counting in JavaScript. This returns
-- the same three aggregates in one call, a few KB.
--
-- Deliberately NOT filtered on sermons.published: The Word is unfiltered by
-- design (see admin_stage3.sql) — only the browse pages gate on it. Filtering
-- here would silently change what the page shows.
--
-- Optional, like word_stats.sql: lib/word-data.js falls back to the paged
-- client path when this function isn't present, so applying it is purely a
-- performance upgrade. Safe to run more than once.
--
-- Uses the existing idx_sermon_scriptures_book (book_id, chapter) index.

create or replace function word_book_detail(p_book_id text)
returns json
language sql
stable
as $$
  with refs as (
    select chapter, verse_start, verse_end, sermon_id
    from sermon_scriptures
    where book_id = p_book_id
  )
  select json_build_object(
    -- One row per chapter that was preached; the client pads the gaps.
    'chapters', coalesce((
      select json_agg(
               json_build_object('chapter', chapter, 'refs', refs, 'messages', messages)
               order by chapter
             )
      from (
        select chapter,
               count(*)::int                     as refs,
               count(distinct sermon_id)::int    as messages
        from refs
        group by chapter
      ) c
    ), '[]'::json),

    -- The six passages opened in the most distinct messages.
    'passages', coalesce((
      select json_agg(
               json_build_object('chapter', chapter, 'vs', vs, 've', ve, 'messages', messages)
               order by messages desc, chapter, vs
             )
      from (
        select chapter,
               verse_start                       as vs,
               coalesce(verse_end, verse_start)  as ve,
               count(distinct sermon_id)::int    as messages
        from refs
        where verse_start is not null
        group by chapter, verse_start, coalesce(verse_end, verse_start)
        order by messages desc, chapter, vs
        limit 6
      ) p
    ), '[]'::json),

    -- Every message that opens the book, most references first.
    'messages', coalesce((
      select json_agg(
               json_build_object(
                 'refs', refs,
                 'sermon', json_build_object(
                   'id', id,
                   'title', title,
                   'sermon_date', sermon_date,
                   'youtube_video_id', youtube_video_id
                 )
               )
               -- Tie-broken on date then id: plain `refs desc` leaves messages
               -- with equal counts in whatever order Postgres returns, which
               -- would reshuffle the previewed 24 between visits.
               order by refs desc, sermon_date desc nulls last, id
             )
      from (
        select s.id, s.title, s.sermon_date, s.youtube_video_id, count(*)::int as refs
        from refs r
        join sermons s on s.id = r.sermon_id
        group by s.id, s.title, s.sermon_date, s.youtube_video_id
      ) m
    ), '[]'::json)
  )
$$;

grant execute on function word_book_detail(text) to anon, authenticated;
