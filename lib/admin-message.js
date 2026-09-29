// lib/admin-message.js
//
// Everything the admin message page (/admin/messages/[id]) shows about one
// message, gathered server-side. Server-only; call after requireAdminPage().

import { adminDb } from '@/lib/admin-db';
import { VIDEO_ID_RE } from '@/lib/admin-api';

const head = { count: 'exact', head: true };

export async function loadMessage(id) {
  const db = adminDb();
  const { data: s, error } = await db
    .from('sermons')
    .select('id, title, youtube_video_id, sermon_date, created_at, video_status, video_checked_at, published, word_studies_none')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!s) return null;

  const counted = async (query) => {
    const { count, error: e } = await query;
    if (e) throw e;
    return count || 0;
  };
  // Jobs queued before the worker saved the row carry only the video id.
  const jobsFilter = VIDEO_ID_RE.test(s.youtube_video_id || '')
    ? `sermon_id.eq.${s.id},youtube_video_id.eq.${s.youtube_video_id}`
    : `sermon_id.eq.${s.id}`;

  const [links, pieces, segments, scriptures, words, declarations, jobs, history] = await Promise.all([
    db.from('series_sermons').select('part_number, series ( id, title )').eq('sermon_id', id).order('part_number'),
    db.rpc('admin_sermon_pieces', { p_ids: [id] }),
    counted(db.from('sermon_segments').select('id', head).eq('sermon_id', id)),
    counted(db.from('sermon_scriptures').select('id', head).eq('sermon_id', id)),
    counted(db.from('sermon_word_studies').select('id', head).eq('sermon_id', id)),
    counted(db.from('declarations').select('id', head).eq('sermon_id', id)),
    db.from('admin_jobs').select('id, status, created_at, finished_at, error').or(jobsFilter).order('created_at', { ascending: false }).limit(5),
    db.from('admin_audit').select('id, at, summary').eq('entity_id', id).order('at', { ascending: false }).limit(12),
  ]);
  if (links.error) throw links.error;
  if (pieces.error) throw pieces.error;

  const p = pieces.data?.[0] || {};
  return {
    ...s,
    series: (links.data || []).filter((l) => l.series).map((l) => ({ id: l.series.id, title: l.series.title, part: l.part_number })),
    transcript: !!p.transcript,
    notes: !!p.notes,
    counts: { segments, scriptures, words, declarations },
    jobs: jobs.error ? [] : jobs.data || [],
    history: history.error ? [] : history.data || [],
  };
}
