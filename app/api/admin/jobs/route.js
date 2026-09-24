import { adminApiGuard } from '@/lib/admin-auth';
import { adminDb } from '@/lib/admin-db';
import { UUID_RE, VIDEO_ID_RE, audit, fail, failFrom, ok, readJson } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

const MAX_ITEMS = 25;
const LIST = 40;

/** GET -> recent jobs, their progress lines, and whether the PC worker is connected. */
export async function GET(req) {
  const denied = adminApiGuard(req);
  if (denied) return denied;

  try {
    const db = adminDb();
    const [{ data: jobs, error }, { data: worker }] = await Promise.all([
      db.from('admin_jobs').select('*').order('created_at', { ascending: false }).limit(LIST),
      db.from('admin_worker').select('last_seen_at, note').eq('id', 1).maybeSingle(),
    ]);
    if (error) throw error;

    // Titles for jobs whose sermon row exists; payload carries the preview title otherwise.
    const ids = [...new Set((jobs || []).map((j) => j.sermon_id).filter(Boolean))];
    const titles = new Map();
    if (ids.length) {
      const { data } = await db.from('sermons').select('id, title').in('id', ids);
      for (const s of data || []) titles.set(s.id, s.title);
    }

    // Progress lines only for jobs someone would open: running, queued, the latest few finished.
    const withEvents = (jobs || []).filter((j, i) => j.status === 'running' || i < 8).map((j) => j.id);
    const events = {};
    if (withEvents.length) {
      const { data } = await db
        .from('admin_job_events')
        .select('job_id, at, level, stage, message')
        .in('job_id', withEvents)
        .order('id', { ascending: true })
        .limit(2000);
      for (const e of data || []) (events[e.job_id] ||= []).push(e);
    }

    return ok({
      jobs: (jobs || []).map((j) => ({ ...j, title: titles.get(j.sermon_id) || j.payload?.title || null })),
      events,
      worker: worker || null,
      now: new Date().toISOString(),
    });
  } catch (e) {
    return failFrom(e, "Couldn't load the queue.");
  }
}

/**
 * POST { items: [{ youtube_video_id, title, series_id|null, part_number|null }] }
 * Queues each confirmed message for the processing computer.
 */
export async function POST(req) {
  const denied = adminApiGuard(req);
  if (denied) return denied;

  try {
    const { items } = await readJson(req);
    if (!Array.isArray(items) || !items.length) return fail('Nothing to add.');
    if (items.length > MAX_ITEMS) return fail(`Add up to ${MAX_ITEMS} at a time.`);

    const db = adminDb();
    const seriesIds = [...new Set(items.map((i) => i.series_id).filter(Boolean))];
    if (seriesIds.some((id) => !UUID_RE.test(id))) return fail('One of the chosen series is not valid.');
    if (seriesIds.length) {
      const { data } = await db.from('series').select('id').in('id', seriesIds);
      if ((data || []).length !== seriesIds.length) return fail('One of the chosen series no longer exists. Reload and try again.');
    }

    const results = [];
    for (const item of items) {
      const vid = String(item.youtube_video_id || '');
      if (!VIDEO_ID_RE.test(vid)) {
        results.push({ youtube_video_id: vid, ok: false, error: 'Not a valid YouTube id.' });
        continue;
      }
      const part = Number.isInteger(item.part_number) && item.part_number > 0 && item.part_number < 1000 ? item.part_number : null;
      const payload = {
        title: String(item.title || '').slice(0, 300) || null,
        series_id: item.series_id || null,
        part_number: item.series_id ? part : null,
      };
      const { data, error } = await db
        .from('admin_jobs')
        .insert([{ kind: 'process_sermon', youtube_video_id: vid, payload }])
        .select('id')
        .single();
      if (error) {
        const already = error.code === '23505';
        results.push({ youtube_video_id: vid, ok: false, error: already ? 'Already waiting or being processed.' : 'Could not queue it.' });
        if (!already) console.error('[admin-jobs] insert failed:', error.message);
        continue;
      }
      results.push({ youtube_video_id: vid, ok: true, job_id: data.id });
    }

    const queued = results.filter((r) => r.ok);
    if (queued.length) {
      await db
        .from('admin_candidates')
        .update({ status: 'queued' })
        .in('youtube_video_id', queued.map((r) => r.youtube_video_id));
      await audit({
        action: 'jobs.queue',
        entity: 'job',
        summary: `Queued ${queued.length} ${queued.length === 1 ? 'message' : 'messages'} for processing`,
        after: items.filter((i) => queued.some((q) => q.youtube_video_id === i.youtube_video_id)),
      });
    }
    return ok({ results });
  } catch (e) {
    return failFrom(e, "Couldn't add those to the queue.");
  }
}
