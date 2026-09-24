import { adminApiGuard } from '@/lib/admin-auth';
import { adminDb } from '@/lib/admin-db';
import { UUID_RE, audit, fail, failFrom, ok, readJson } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

const COLUMNS = 'id, sermon_id, word, language, original_script, meaning, reference, note, strongs_number';

async function load(id) {
  const { data, error } = await adminDb().from('sermon_word_studies').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** PATCH { meaning?, note? } -> correct the explanation or the reviewer's note. */
export async function PATCH(req, { params }) {
  const denied = adminApiGuard(req);
  if (denied) return denied;
  if (!UUID_RE.test(params.id)) return fail('Unknown word study.', 404);

  try {
    const body = await readJson(req);
    const before = await load(params.id);
    if (!before) return fail('Unknown word study.', 404);

    const patch = {};
    if (body.meaning !== undefined) {
      const meaning = String(body.meaning).trim();
      if (meaning.length < 3 || meaning.length > 3000) return fail('Write a meaning between 3 and 3,000 characters.');
      if (meaning !== before.meaning) patch.meaning = meaning;
    }
    if (body.note !== undefined) {
      const note = String(body.note).trim();
      if (note.length > 2000) return fail('Keep the note under 2,000 characters.');
      if ((note || null) !== (before.note || null)) patch.note = note || null;
    }
    if (!Object.keys(patch).length) return ok({ word: before });

    const { data, error } = await adminDb().from('sermon_word_studies').update(patch).eq('id', params.id).select(COLUMNS).single();
    if (error) throw error;
    await audit({
      action: 'word_study.update',
      entity: 'word_study',
      entityId: params.id,
      summary: `Edited the word study "${before.word}"`,
      before: { meaning: before.meaning, note: before.note, sermon_id: before.sermon_id },
      after: patch,
    });
    return ok({ word: data });
  } catch (e) {
    return failFrom(e, "Couldn't save the word study.");
  }
}

/** DELETE -> remove a word study that isn't really in the message. */
export async function DELETE(req, { params }) {
  const denied = adminApiGuard(req);
  if (denied) return denied;
  if (!UUID_RE.test(params.id)) return fail('Unknown word study.', 404);

  try {
    const before = await load(params.id);
    if (!before) return fail('Unknown word study.', 404);
    const { error } = await adminDb().from('sermon_word_studies').delete().eq('id', params.id);
    if (error) throw error;
    await audit({
      action: 'word_study.delete',
      entity: 'word_study',
      entityId: params.id,
      summary: `Deleted the word study "${before.word}" (${before.language})`,
      before,
    });
    return ok();
  } catch (e) {
    return failFrom(e, "Couldn't delete the word study.");
  }
}
