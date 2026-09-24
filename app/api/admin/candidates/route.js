import { adminApiGuard } from '@/lib/admin-auth';
import { adminDb } from '@/lib/admin-db';
import { VIDEO_ID_RE, audit, fail, failFrom, ok, readJson } from '@/lib/admin-api';
import { MIN_SERMON_SECONDS, recentUploads, videoDetails } from '@/lib/admin-youtube';

export const dynamic = 'force-dynamic';

const WINDOW_DAYS = 60;

/** GET -> the "New on YouTube" list (not yet added, not dismissed). */
export async function GET(req) {
  const denied = adminApiGuard(req);
  if (denied) return denied;
  try {
    const { data, error } = await adminDb()
      .from('admin_candidates')
      .select('*')
      .eq('status', 'new')
      .order('published_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return ok({ candidates: data || [] });
  } catch (e) {
    return failFrom(e, "Couldn't load the new uploads.");
  }
}

/**
 * POST { action: 'refresh' }  -> look at the channel now (same rules as the
 *   nightly check-uploads.js: last 60 days, 20+ minutes, not already known).
 * POST { action: 'dismiss', youtube_video_id } -> hide one from the list.
 */
export async function POST(req) {
  const denied = adminApiGuard(req);
  if (denied) return denied;

  try {
    const body = await readJson(req);
    const db = adminDb();

    if (body.action === 'dismiss') {
      if (!VIDEO_ID_RE.test(body.youtube_video_id || '')) return fail('Unknown video.');
      const { error } = await db.from('admin_candidates').update({ status: 'dismissed' }).eq('youtube_video_id', body.youtube_video_id);
      if (error) throw error;
      await audit({ action: 'candidate.dismiss', entity: 'candidate', entityId: body.youtube_video_id, summary: 'Hid a new upload from the list' });
      return ok();
    }

    if (body.action !== 'refresh') return fail('Unknown action.');

    const cutoff = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const recent = (await recentUploads(4)).filter((v) => v.youtube_video_id && new Date(v.published_at).getTime() >= cutoff);
    if (!recent.length) return ok({ added: 0, looked_at: 0 });

    const ids = recent.map((v) => v.youtube_video_id);
    const [known, listed] = await Promise.all([
      db.from('sermons').select('youtube_video_id').in('youtube_video_id', ids),
      db.from('admin_candidates').select('youtube_video_id').in('youtube_video_id', ids),
    ]);
    if (known.error) throw known.error;
    if (listed.error) throw listed.error;
    const skip = new Set([...(known.data || []), ...(listed.data || [])].map((r) => r.youtube_video_id));

    const fresh = recent.filter((v) => !skip.has(v.youtube_video_id));
    let rows = [];
    let clips = 0;
    if (fresh.length) {
      const details = await videoDetails(fresh.map((v) => v.youtube_video_id));
      for (const v of fresh) {
        const secs = details.get(v.youtube_video_id)?.duration_seconds ?? null;
        if (secs && secs < MIN_SERMON_SECONDS) {
          clips++;
          continue;
        }
        rows.push({ ...v, duration_seconds: secs, status: 'new' });
      }
      if (rows.length) {
        const { error } = await db
          .from('admin_candidates')
          .upsert(rows, { onConflict: 'youtube_video_id', ignoreDuplicates: true });
        if (error) throw error;
      }
    }
    return ok({ added: rows.length, clips, looked_at: recent.length });
  } catch (e) {
    return failFrom(e, "Couldn't check YouTube just now.");
  }
}
