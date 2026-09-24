import { adminApiGuard } from '@/lib/admin-auth';
import { adminDb } from '@/lib/admin-db';
import { failFrom, ok } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

/**
 * GET ?q=<words>&unlinked=1 -> find messages by title (admin lookup, up to 20).
 * This is a name filter for the admin, not search for a visitor's question, so
 * a plain title match is right here (CLAUDE.md rule 2 is about retrieval).
 */
export async function GET(req) {
  const denied = adminApiGuard(req);
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
    const unlinked = url.searchParams.get('unlinked') === '1';
    if (q.length < 2) return ok({ sermons: [] });

    const db = adminDb();
    // Every word must appear, in any order. Escape PostgREST/LIKE wildcards.
    const words = q.split(/\s+/).filter(Boolean).slice(0, 6).map((w) => w.replace(/[%_,()*\\]/g, ''));
    let query = db
      .from('sermons')
      .select('id, title, youtube_video_id, sermon_date, series_sermons ( part_number, series ( id, title ) )')
      .order('sermon_date', { ascending: false })
      .limit(unlinked ? 60 : 20);
    for (const w of words) if (w) query = query.ilike('title', `%${w}%`);
    const { data, error } = await query;
    if (error) throw error;

    let rows = (data || []).map((s) => {
      const link = s.series_sermons?.[0];
      return {
        id: s.id,
        title: s.title,
        youtube_video_id: s.youtube_video_id,
        sermon_date: s.sermon_date,
        series: link ? { id: link.series?.id, title: link.series?.title, part_number: link.part_number } : null,
      };
    });
    if (unlinked) rows = rows.filter((r) => !r.series).slice(0, 20);
    return ok({ sermons: rows });
  } catch (e) {
    return failFrom(e, "Couldn't search just now.");
  }
}
