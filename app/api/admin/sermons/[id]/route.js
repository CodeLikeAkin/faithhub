import { adminApiGuard } from '@/lib/admin-auth';
import { UUID_RE, fail, failFrom, ok, readJson } from '@/lib/admin-api';
import { loadSermon, renameSermon, setDeclarationsNone, setPublished, setWordStudiesNone } from '@/lib/admin-sermons';

export const dynamic = 'force-dynamic';

/**
 * PATCH { title?, published?, word_studies_none?, declarations_none? } -> change one message.
 * Each field is saved and recorded in History on its own.
 */
export async function PATCH(req, { params }) {
  const denied = adminApiGuard(req);
  if (denied) return denied;
  if (!UUID_RE.test(params.id)) return fail('Unknown message.', 404);

  try {
    const body = await readJson(req);
    const before = await loadSermon(params.id);
    if (!before) return fail('Unknown message.', 404);

    if (body.title !== undefined) {
      const title = String(body.title || '').replace(/\s+/g, ' ').trim();
      if (title.length < 4 || title.length > 300) return fail('Use a title between 4 and 300 characters.');
      if (title !== before.title) await renameSermon(before, title);
    }

    if (body.word_studies_none !== undefined) {
      if (typeof body.word_studies_none !== 'boolean') return fail('Bad request.');
      if (body.word_studies_none !== before.word_studies_none) await setWordStudiesNone(before, body.word_studies_none);
    }

    if (body.declarations_none !== undefined) {
      if (typeof body.declarations_none !== 'boolean') return fail('Bad request.');
      if (body.declarations_none !== before.declarations_none) await setDeclarationsNone(before, body.declarations_none);
    }

    let series = [];
    if (body.published !== undefined) {
      if (typeof body.published !== 'boolean') return fail('Bad request.');
      ({ series } = await setPublished([before.id], body.published));
    }

    return ok({ sermon: await loadSermon(params.id), summaries_cleared: series });
  } catch (e) {
    return failFrom(e, "Couldn't save that change.");
  }
}
