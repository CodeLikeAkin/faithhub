// lib/declarations-left-out.js  (server only)
//
// Declarations come from Dad and Mom. Guest ministers' messages and the
// celebration / panel / tribute videos are left out of every declarations
// surface (topic grid, "What are you facing?", daily set, Today card), with no
// opt-in: unlike Ask, nobody names a speaker when browsing (2026-10-05).
//
// There is no speaker column, so who preached is read from the YouTube title
// (lib/speakers.js). The RPCs behind the declarations pages take no speaker
// filter, so callers exclude by id:
//   sermonIds       — for table queries and rows that carry sermon_id
//   declarationIds  — for the RPCs' exclude_ids (they return no sermon_id)

import { createClient } from '@supabase/supabase-js';
import { detectSpeaker, isMultiVoice } from './speakers';

const TTL_MS = 10 * 60_000;
let cache = { at: 0, value: null };

const unescape = (t) => String(t || '').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/** Sermon ids a declarations surface must not draw from, from [{ id, title }]. */
export function leftOutSermonIds(rows) {
  return (rows || [])
    .filter((r) => {
      const title = unescape(r.title);
      return detectSpeaker(title).isGuest || isMultiVoice(title);
    })
    .map((r) => r.id);
}

/** { sermonIds, declarationIds }, cached for ten minutes per server instance. */
export async function loadLeftOut() {
  if (cache.value && Date.now() - cache.at < TTL_MS) return cache.value;

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('sermons').select('id, title').range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const sermonIds = leftOutSermonIds(rows);

  const declarationIds = [];
  for (let i = 0; i < sermonIds.length; i += 50) {
    const { data, error } = await db.from('declarations').select('id').in('sermon_id', sermonIds.slice(i, i + 50)).limit(5000);
    if (error) throw new Error(error.message);
    declarationIds.push(...data.map((d) => d.id));
  }

  cache = { at: Date.now(), value: { sermonIds, declarationIds } };
  return cache.value;
}

/** loadLeftOut() that never throws: on failure nothing is left out, as before. */
export async function loadLeftOutSafe() {
  try {
    return await loadLeftOut();
  } catch (err) {
    console.error('[declarations] Could not load the guest/celebration list; not filtering:', err.message);
    return { sermonIds: [], declarationIds: [] };
  }
}
