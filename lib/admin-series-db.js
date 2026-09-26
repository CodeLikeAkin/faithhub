// lib/admin-series-db.js
//
// Server-side series reads/writes shared by the Series API routes and pages.

import { adminDb } from '@/lib/admin-db';
import { matchSeries, proposeSeries } from '@/lib/admin-series';

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

/** Keep series.total_parts and its date range honest after the parts change. */
export async function syncSeriesTotals(seriesId) {
  const db = adminDb();
  const { data: parts, error } = await db
    .from('series_sermons')
    .select('part_number, sermons ( sermon_date )')
    .eq('series_id', seriesId);
  if (error) throw error;
  const dates = (parts || []).map((p) => p.sermons?.sermon_date).filter(Boolean).sort();
  const patch = {
    total_parts: Math.max(0, ...(parts || []).map((p) => p.part_number || 0)),
    start_date: dates[0] || null,
    end_date: dates[dates.length - 1] || null,
  };
  const { error: e } = await db.from('series').update(patch).eq('id', seriesId);
  if (e) throw e;
}

/**
 * New-series suggestions, exactly as `node propose-series.js` would make them:
 * sermons in no series, whose title matches no existing series, grouped by
 * title stem. Confident = the church numbered at least one part.
 */
export async function loadProposals() {
  const db = adminDb();
  const [sermons, series, links] = await Promise.all([
    allRows(() => db.from('sermons').select('id, title, sermon_date, youtube_video_id, video_status')),
    allRows(() => db.from('series').select('id, title')),
    allRows(() => db.from('series_sermons').select('sermon_id')),
  ]);
  const linked = new Set(links.map((l) => l.sermon_id));
  // A video that won't play can't be studied, so it never seeds a suggestion.
  // (This is what keeps the June 2026 Glory Cloud airing, deleted on
  // 2026-09-19 because its videos are gone, from being suggested again.)
  const dead = (s) => s.video_status === 'private' || s.video_status === 'deleted';
  const orphans = sermons.filter((s) => !linked.has(s.id) && !dead(s) && !matchSeries(s.title, series));
  const { confident, possible } = proposeSeries(orphans, series);
  const slim = (p) => ({
    title: p.title,
    key: p.key,
    notes: p.notes || [],
    collisions: p.collisions,
    parts: p.parts.map((x) => ({
      sermon_id: x.id,
      title: x.title,
      youtube_video_id: x.youtube_video_id,
      part_number: x.part_number,
      explicit: x.explicit,
      preached: x.preached ? x.preached.toISOString() : null,
      sermon_date: x.sermon_date,
    })),
  });
  return { confident: confident.map(slim), possible: possible.map(slim), orphanCount: orphans.length };
}
