import { adminApiGuard } from '@/lib/admin-auth';
import { adminDb } from '@/lib/admin-db';
import { UUID_RE, audit, embedText, fail, failFrom, ok, readJson } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

// Same ten tags the careful pass may use (claude-extraction/save-declarations.js).
const VALID_TAGS = new Set([
  'mindset', 'faith', 'healing', 'finances', 'relationships',
  'purpose', 'fear', 'strength', 'identity', 'blessing',
]);

const COLUMNS = 'id, sermon_id, declaration_text, timestamp_seconds, topic_tags, youtube_url_with_timestamp';

async function load(id) {
  const { data, error } = await adminDb().from('declarations').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

const short = (t) => (t.length > 70 ? `${t.slice(0, 67)}...` : t);

/**
 * PATCH { declaration_text?, topic_tags? } -> fix a declaration. New wording is
 * re-embedded (gte-small via the embed function) so search still finds it;
 * the full-text column updates itself.
 */
export async function PATCH(req, { params }) {
  const denied = adminApiGuard(req);
  if (denied) return denied;
  if (!UUID_RE.test(params.id)) return fail('Unknown declaration.', 404);

  try {
    const body = await readJson(req);
    const before = await load(params.id);
    if (!before) return fail('Unknown declaration.', 404);

    const patch = {};
    if (body.declaration_text !== undefined) {
      const text = String(body.declaration_text).replace(/\s+/g, ' ').trim();
      if (text.split(' ').length < 5) return fail('A declaration needs at least 5 words.');
      if (text.length > 600) return fail('That is too long for one declaration.');
      if (text !== before.declaration_text) {
        patch.declaration_text = text;
        patch.embedding = await embedText(text);
      }
    }
    if (body.topic_tags !== undefined) {
      if (!Array.isArray(body.topic_tags)) return fail('Bad themes.');
      const tags = [...new Set(body.topic_tags.map(String))].filter((t) => VALID_TAGS.has(t));
      if (!tags.length) return fail('Pick at least one theme.');
      const same = tags.length === (before.topic_tags || []).length && tags.every((t) => before.topic_tags.includes(t));
      if (!same) patch.topic_tags = tags;
    }
    if (!Object.keys(patch).length) return ok({ declaration: before });

    const { data, error } = await adminDb().from('declarations').update(patch).eq('id', params.id).select(COLUMNS).single();
    if (error) throw error;

    const { embedding, ...afterFields } = patch;
    await audit({
      action: 'declaration.update',
      entity: 'declaration',
      entityId: params.id,
      summary: `Edited a declaration: "${short(data.declaration_text)}"`,
      before: { declaration_text: before.declaration_text, topic_tags: before.topic_tags, sermon_id: before.sermon_id },
      after: afterFields,
    });
    return ok({ declaration: data });
  } catch (e) {
    return failFrom(e, "Couldn't save the declaration.");
  }
}

/** DELETE -> remove one declaration (the full row is kept in History). */
export async function DELETE(req, { params }) {
  const denied = adminApiGuard(req);
  if (denied) return denied;
  if (!UUID_RE.test(params.id)) return fail('Unknown declaration.', 404);

  try {
    const before = await load(params.id);
    if (!before) return fail('Unknown declaration.', 404);
    const { error } = await adminDb().from('declarations').delete().eq('id', params.id);
    if (error) throw error;
    await audit({
      action: 'declaration.delete',
      entity: 'declaration',
      entityId: params.id,
      summary: `Deleted a declaration: "${short(before.declaration_text)}"`,
      before,
    });
    return ok();
  } catch (e) {
    return failFrom(e, "Couldn't delete the declaration.");
  }
}
