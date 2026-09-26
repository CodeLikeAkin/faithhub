import { adminApiGuard } from '@/lib/admin-auth';
import { adminDb } from '@/lib/admin-db';
import { UUID_RE, audit, fail, failFrom, ok, readJson } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

/** POST { action: 'retry' | 'cancel' } for one job. */
export async function POST(req, { params }) {
  const denied = adminApiGuard(req);
  if (denied) return denied;
  if (!UUID_RE.test(params.id)) return fail('Unknown job.', 404);

  try {
    const { action } = await readJson(req);
    const db = adminDb();
    const { data: job, error } = await db.from('admin_jobs').select('*').eq('id', params.id).maybeSingle();
    if (error) throw error;
    if (!job) return fail('Unknown job.', 404);

    if (action === 'cancel') {
      if (job.status !== 'queued') return fail('Only a job that is still waiting can be cancelled.');
      const { error: e } = await db
        .from('admin_jobs')
        .update({ status: 'cancelled', finished_at: new Date().toISOString() })
        .eq('id', job.id)
        .eq('status', 'queued');
      if (e) throw e;
      await db.from('admin_candidates').update({ status: 'new' }).eq('youtube_video_id', job.youtube_video_id).eq('status', 'queued');
      await audit({ action: 'job.cancel', entity: 'job', entityId: job.id, summary: `Cancelled processing of ${job.payload?.title || job.youtube_video_id}` });
      return ok();
    }

    if (action === 'retry') {
      if (!['failed', 'cancelled'].includes(job.status)) return fail('Only a failed or cancelled job can be retried.');
      // A fresh row keeps the failed attempt (and its progress lines) in the history.
      const { error: e } = await db
        .from('admin_jobs')
        .insert([{ kind: job.kind, youtube_video_id: job.youtube_video_id, payload: job.payload, sermon_id: job.sermon_id }]);
      if (e) {
        if (e.code === '23505') return fail('This message is already waiting or being processed.');
        throw e;
      }
      await audit({ action: 'job.retry', entity: 'job', entityId: job.id, summary: `Retried processing of ${job.payload?.title || job.youtube_video_id}` });
      return ok();
    }

    return fail('Unknown action.');
  } catch (e) {
    return failFrom(e);
  }
}
