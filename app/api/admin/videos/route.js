import { adminApiGuard } from '@/lib/admin-auth';
import { adminDb } from '@/lib/admin-db';
import { audit, fail, failFrom, ok, readJson } from '@/lib/admin-api';
import { embedStatus } from '@/lib/admin-youtube';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ~0.4s per video, so a click stays well inside a serverless time limit.
const BATCH = 25;

/**
 * POST { action: 'check' } -> check whether videos still play (oEmbed; no key,
 * no quota): every video never checked or whose last check failed, up to 25
 * per click. Same verdicts as the pipeline's check-video-status.js.
 */
export async function POST(req) {
  const denied = adminApiGuard(req);
  if (denied) return denied;

  try {
    const { action } = await readJson(req);
    if (action !== 'check') return fail('Unknown action.');

    const db = adminDb();
    const { data: todo, error } = await db
      .from('sermons')
      .select('id, youtube_video_id, video_status')
      .not('youtube_video_id', 'is', null)
      .or('video_status.is.null,video_status.eq.unknown')
      .limit(BATCH);
    if (error) throw error;

    const counts = { ok: 0, private: 0, deleted: 0, unknown: 0 };
    for (const s of todo || []) {
      const status = await embedStatus(s.youtube_video_id);
      counts[status]++;
      const { error: e } = await db
        .from('sermons')
        .update({ video_status: status, video_checked_at: new Date().toISOString() })
        .eq('id', s.id);
      if (e) console.error('[admin-videos] update failed:', e.message);
      await new Promise((r) => setTimeout(r, 150)); // polite pacing on a public endpoint
    }

    if (todo?.length) {
      await audit({
        action: 'videos.check',
        entity: 'sermon',
        summary: `Checked ${todo.length} videos: ${counts.ok} play, ${counts.private + counts.deleted} don't`,
        after: counts,
      });
    }
    return ok({ checked: todo?.length || 0, counts });
  } catch (e) {
    return failFrom(e, "Couldn't check the videos just now.");
  }
}
