// lib/admin-dashboard.js
//
// Everything the admin Overview shows, gathered server-side with the service
// key. Each block loads independently and reports its own error, so one slow
// query (the free tier times out now and then) never blanks the whole page.
//
// Server-only. Call after requireAdminPage().

import { adminDb } from '@/lib/admin-db';

export const TIME_ZONE = 'Africa/Lagos';
const WORKER_ONLINE_MINUTES = 10;
const RECENT_COUNT = 6;

// PostgREST answers "function/table not found" when admin_stage1.sql hasn't been run.
export const isMissingSetup = (error) =>
  !!error &&
  (['PGRST202', 'PGRST205', '42883', '42P01'].includes(error.code) ||
    /schema cache|does not exist/i.test(error.message || ''));

const settle = async (promise) => {
  try {
    const { data, error, count } = await promise;
    return { data, error: error || null, count };
  } catch (e) {
    return { data: null, error: { message: String(e?.message || e) }, count: null };
  }
};

async function allRows(build) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

// "2026-09" in Lagos time.
const monthKey = (date) => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit' })
    .formatToParts(date);
  return `${p.find((x) => x.type === 'year').value}-${p.find((x) => x.type === 'month').value}`;
};

function lastTwelveMonths(now) {
  const [y, m] = monthKey(now).split('-').map(Number);
  const out = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 15));
    out.push({
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
      short: d.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' }).slice(0, 3), // "Sep", not en-GB's "Sept"
      long: d.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      count: 0,
      partial: i === 0,
    });
  }
  return out;
}

async function loadLibrary(db, now) {
  const rows = await allRows(() => db.from('sermons').select('sermon_date, created_at'));
  const months = lastTwelveMonths(now);
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const r of rows) {
    const k = (r.sermon_date || '').slice(0, 7);
    if (byKey.has(k)) byKey.get(k).count++;
  }
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const addedThisWeek = rows.filter((r) => r.created_at && new Date(r.created_at).getTime() > weekAgo).length;
  return { months, addedThisWeek };
}

// Which of the five pieces each recent sermon has.
async function loadRecent(db) {
  const { data: sermons, error } = await db
    .from('sermons')
    .select('id, title, sermon_date, created_at, youtube_video_id, video_status')
    .order('created_at', { ascending: false })
    .order('sermon_date', { ascending: false })
    .limit(RECENT_COUNT);
  if (error) throw error;
  if (!sermons?.length) return [];

  const ids = sermons.map((s) => s.id);
  const idsWith = async (table) => {
    const { data, error: e } = await db.from(table).select('sermon_id').in('sermon_id', ids).limit(10000);
    if (e) throw e;
    return new Set((data || []).map((r) => r.sermon_id));
  };

  const [links, segments, scriptures, words, declarations, notes] = await Promise.all([
    db.from('series_sermons').select('sermon_id, part_number, series ( title )').in('sermon_id', ids),
    idsWith('sermon_segments'),
    idsWith('sermon_scriptures'),
    idsWith('sermon_word_studies'),
    idsWith('declarations'),
    db.from('sermons').select('id').in('id', ids).not('study_notes', 'is', null),
  ]);
  if (links.error) throw links.error;
  if (notes.error) throw notes.error;

  const seriesOf = new Map((links.data || []).map((l) => [l.sermon_id, l]));
  const withNotes = new Set((notes.data || []).map((r) => r.id));

  return sermons.map((s) => {
    const link = seriesOf.get(s.id);
    return {
      ...s,
      series: link ? { title: link.series?.title || 'A series', part: link.part_number } : null,
      pieces: {
        search: segments.has(s.id),
        scriptures: scriptures.has(s.id),
        words: words.has(s.id),
        declarations: declarations.has(s.id),
        notes: withNotes.has(s.id),
      },
    };
  });
}

function workerState(res) {
  if (isMissingSetup(res.error)) return { state: 'setup', minutes: null };
  if (res.error) return { state: 'error', minutes: null };
  const seen = res.data?.last_seen_at;
  if (!seen) return { state: 'never', minutes: null };
  const minutes = Math.max(0, Math.round((Date.now() - new Date(seen).getTime()) / 60000));
  return { state: minutes > WORKER_ONLINE_MINUTES ? 'offline' : 'online', minutes };
}

/** Just the processing-computer state, for pages that only need that. */
export async function loadWorker() {
  return workerState(await settle(adminDb().from('admin_worker').select('last_seen_at').eq('id', 1).maybeSingle()));
}

export async function loadDashboard() {
  const db = adminDb();
  const now = new Date();

  const [coverage, segmentGaps, worker, declarations, unknownVideos, library, recent] = await Promise.all([
    settle(db.rpc('admin_coverage')),
    settle(db.rpc('admin_segment_gaps')),
    settle(db.from('admin_worker').select('last_seen_at').eq('id', 1).maybeSingle()),
    settle(db.from('declarations').select('id', { count: 'exact', head: true })),
    settle(db.from('sermons').select('id', { count: 'exact', head: true }).eq('video_status', 'unknown')),
    settle(loadLibrary(db, now).then((data) => ({ data }))),
    settle(loadRecent(db).then((data) => ({ data }))),
  ]);

  return {
    now,
    needsSetup: isMissingSetup(coverage.error),
    coverage: coverage.data,
    coverageError: coverage.error && !isMissingSetup(coverage.error) ? coverage.error : null,
    segmentGaps: typeof segmentGaps.data === 'number' ? segmentGaps.data : null,
    worker: workerState(worker),
    declarationsTotal: declarations.error ? null : declarations.count,
    unknownVideos: unknownVideos.error ? 0 : unknownVideos.count || 0,
    library: library.data,
    recent: recent.data,
    recentError: recent.error,
    youtubeKey: !!process.env.YOUTUBE_API_KEY,
  };
}
