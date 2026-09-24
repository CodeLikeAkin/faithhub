import { adminApiGuard } from '@/lib/admin-auth';
import { adminDb } from '@/lib/admin-db';
import { UUID_RE, audit, fail, failFrom, ok, readJson } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

const MAX = 60_000;

async function load(id) {
  const { data, error } = await adminDb().from('sermons').select('id, title, study_notes').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** GET -> the message's study notes (markdown). */
export async function GET(req, { params }) {
  const denied = adminApiGuard(req);
  if (denied) return denied;
  if (!UUID_RE.test(params.id)) return fail('Unknown message.', 404);
  try {
    const s = await load(params.id);
    if (!s) return fail('Unknown message.', 404);
    return ok({ study_notes: s.study_notes || '' });
  } catch (e) {
    return failFrom(e, "Couldn't load the notes.");
  }
}

/** PUT { study_notes } -> replace the notes. Empty clears them (the old text stays in History). */
export async function PUT(req, { params }) {
  const denied = adminApiGuard(req);
  if (denied) return denied;
  if (!UUID_RE.test(params.id)) return fail('Unknown message.', 404);

  try {
    const { study_notes } = await readJson(req, MAX + 10_000);
    const next = String(study_notes ?? '').replace(/\r\n/g, '\n').trim();
    if (next.length > MAX) return fail('The notes are too long.');

    const before = await load(params.id);
    if (!before) return fail('Unknown message.', 404);
    if ((before.study_notes || '').trim() === next) return ok();

    const { error } = await adminDb().from('sermons').update({ study_notes: next || null }).eq('id', params.id);
    if (error) throw error;
    await audit({
      action: next ? 'notes.update' : 'notes.clear',
      entity: 'sermon',
      entityId: params.id,
      summary: `${next ? 'Edited' : 'Cleared'} the study notes for "${before.title}"`,
      before: { study_notes: before.study_notes },
      after: { study_notes: next || null },
    });
    return ok();
  } catch (e) {
    return failFrom(e, "Couldn't save the notes.");
  }
}
