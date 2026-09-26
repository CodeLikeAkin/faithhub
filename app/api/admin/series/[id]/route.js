import { adminApiGuard } from '@/lib/admin-auth';
import { adminDb } from '@/lib/admin-db';
import { UUID_RE, audit, fail, failFrom, ok, readJson } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

async function loadSeries(id) {
  const { data, error } = await adminDb()
    .from('series')
    .select('id, title, study_summary, suggested_questions')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** PATCH { title } -> rename. Future uploads are matched to a series by this name. */
export async function PATCH(req, { params }) {
  const denied = adminApiGuard(req);
  if (denied) return denied;
  if (!UUID_RE.test(params.id)) return fail('Unknown series.', 404);

  try {
    const { title: raw } = await readJson(req);
    const title = String(raw || '').replace(/\s+/g, ' ').trim();
    if (title.length < 4 || title.length > 150) return fail('Use a name between 4 and 150 characters.');

    const before = await loadSeries(params.id);
    if (!before) return fail('Unknown series.', 404);
    if (before.title === title) return ok();

    const db = adminDb();
    const { data: dup } = await db.from('series').select('id').ilike('title', title).neq('id', params.id);
    if (dup?.length) return fail('Another series already has that name.');

    const { error } = await db.from('series').update({ title }).eq('id', params.id);
    if (error) throw error;
    await audit({
      action: 'series.rename',
      entity: 'series',
      entityId: params.id,
      summary: `Renamed "${before.title}" to "${title}"`,
      before: { title: before.title },
      after: { title },
    });
    return ok();
  } catch (e) {
    return failFrom(e, "Couldn't rename the series.");
  }
}

/**
 * POST { action: 'refresh_summary' } -> clear the cached summary and suggested
 * questions. The public series page writes a fresh one (Groq) the next time
 * someone opens it; /api/series-summary otherwise never regenerates.
 */
export async function POST(req, { params }) {
  const denied = adminApiGuard(req);
  if (denied) return denied;
  if (!UUID_RE.test(params.id)) return fail('Unknown series.', 404);

  try {
    const { action } = await readJson(req);
    if (action !== 'refresh_summary') return fail('Unknown action.');
    const before = await loadSeries(params.id);
    if (!before) return fail('Unknown series.', 404);

    const { error } = await adminDb()
      .from('series')
      .update({ study_summary: null, suggested_questions: null })
      .eq('id', params.id);
    if (error) throw error;
    await audit({
      action: 'series.refresh_summary',
      entity: 'series',
      entityId: params.id,
      summary: `Cleared the summary of "${before.title}" so it is rewritten`,
      before: { study_summary: before.study_summary, suggested_questions: before.suggested_questions },
    });
    return ok();
  } catch (e) {
    return failFrom(e, "Couldn't refresh the summary.");
  }
}
