"use client";

// Data for The Word, cached for the session: moving between /word,
// /word/romans and /word/romans/8 remounts the page, and none of these
// should refetch what's already here.

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { bookIdFor, fetchPassage } from "./bible";

let statsPromise = null;
const rowsByBook = new Map(); // bookId -> Promise<rows>
const chapterText = new Map(); // `${bookId}|${chapter}|${translation}` -> Promise<Map<verse, text>>

/** { [bookId]: { refs, sermons } } — grouped RPC, else paged + aggregated here. */
export function loadBookStats() {
  if (!statsPromise) {
    statsPromise = (async () => {
      const byId = {};
      const { data: rpc, error } = await supabase.rpc("word_book_stats");
      if (!error && Array.isArray(rpc)) {
        for (const row of rpc) {
          const id = row.book_id || bookIdFor(row.book);
          if (!id) continue;
          byId[id] = { refs: Number(row.ref_count) || 0, sermons: Number(row.sermon_count) || 0 };
        }
        return byId;
      }
      // Fallback (word_stats.sql not applied): page the table here.
      const seen = {};
      for (let from = 0; ; from += 1000) {
        const { data, error: e } = await supabase
          .from("sermon_scriptures")
          .select("book, book_id, sermon_id")
          .order("id")
          .range(from, from + 999);
        if (e || !data?.length) break;
        for (const r of data) {
          const id = r.book_id || bookIdFor(r.book);
          if (!id) continue;
          byId[id] ||= { refs: 0, sermons: 0 };
          byId[id].refs += 1;
          (seen[id] ||= new Set()).add(r.sermon_id);
        }
        if (data.length < 1000) break;
      }
      for (const id of Object.keys(seen)) byId[id].sermons = seen[id].size;
      return byId;
    })().catch((err) => {
      statsPromise = null; // let a later mount retry
      throw err;
    });
  }
  return statsPromise;
}

/**
 * Every reference to one book, with its sermon. Paged: a single select caps
 * at PostgREST's 1000 rows, and Psalms / Acts / Romans / John run past it.
 * Ordered by chapter then id so the pages never overlap or skip.
 */
export function loadBookRows(bookId) {
  if (!rowsByBook.has(bookId)) {
    const p = (async () => {
      const all = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("sermon_scriptures")
          .select(
            "id, reference, chapter, verse_start, verse_end, theme, timestamp_seconds, sermon:sermons ( id, title, sermon_date, youtube_video_id )"
          )
          .eq("book_id", bookId)
          .order("chapter", { ascending: true })
          .order("id", { ascending: true })
          .range(from, from + 999);
        if (error) throw error;
        if (!data?.length) break;
        all.push(...data);
        if (data.length < 1000) break;
      }
      return all;
    })();
    p.catch(() => rowsByBook.delete(bookId));
    rowsByBook.set(bookId, p);
  }
  return rowsByBook.get(bookId);
}

/** A whole chapter's text as Map(verse number → text). */
export function loadChapterText(book, chapter, translation = "KJV") {
  const key = `${book.id}|${chapter}|${translation}`;
  if (!chapterText.has(key)) {
    const p = fetchPassage({ book: book.name, bookId: book.id, chapter }, translation).then((r) => {
      if (!r?.verses?.length) throw new Error("no text");
      return new Map(r.verses.map((v) => [v.number, v.text]));
    });
    p.catch(() => chapterText.delete(key));
    chapterText.set(key, p);
  }
  return chapterText.get(key);
}

/** Tiny promise → state hook: { data, error, loading }. */
export function useLoad(load, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  useEffect(() => {
    let live = true;
    setState((s) => ({ data: s.data, error: null, loading: true }));
    Promise.resolve()
      .then(load)
      .then(
        (data) => live && setState({ data, error: null, loading: false }),
        (error) => live && setState({ data: null, error, loading: false })
      );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
