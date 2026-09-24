import { adminApiGuard } from '@/lib/admin-auth';
import { adminDb } from '@/lib/admin-db';
import { UUID_RE, audit, fail, failFrom, ok, readJson } from '@/lib/admin-api';
import { syncSeriesTotals } from '@/lib/admin-series-db';

export const dynamic = 'force-dynamic';

/**
 * POST { title, parts: [{ sermon_id, part_number }] } -> create a new series.
 * Additive only (same guarantees as `propose-series.js --apply`): refuses a
 * duplicate title and any sermon that is already in a series.
 */
export async function POST(req) {
  const denied = adminApiGuard(req);
  if (denied) return denied;

  try {
    const { title: rawTitle, parts } = await readJson(req);
    const title = String(rawTitle || '').replace(/\s+/g, ' ').trim();
    if (title.length < 4 || title.length > 150) return fail('Give the series a name between 4 and 150 characters.');
    if (!Array.isArray(parts) || parts.length < 2 || parts.length > 100) return fail('A series needs at least 2 messages.');
    if (parts.some((p) => !UUID_RE.test(p.sermon_id || '') || !Number.isInteger(p.part_number) || p.part_number < 1 || p.part_number > 999)) {
      return fail('Every message needs a part number from 1 to 999.');
    }
    const ids = parts.map((p) => p.sermon_id);
    if (new Set(ids).size !== ids.length) return fail('The same message is listed twice.');

    const db = adminDb();
    const { data: dup } = await db.from('series').select('id').ilike('title', title);
    if (dup?.length) return fail('A series with that name already exists.');

    const { data: taken } = await db.from('series_sermons').select('sermon_id').in('sermon_id', ids);
    if (taken?.length) return fail(`${taken.length} of these messages are already in a series. Reload and try again.`);

    const { data: series, error } = await db.from('series').insert([{ title }]).select('id, title').single();
    if (error) throw error;

    const rows = parts.map((p) => ({ series_id: series.id, sermon_id: p.sermon_id, part_number: p.part_number }));
    const { error: le } = await db.from('series_sermons').insert(rows);
    if (le) {
      // Don't leave an empty series behind if the links failed.
      await db.from('series').delete().eq('id', series.id);
      throw le;
    }
    await syncSeriesTotals(series.id);

    await audit({
      action: 'series.create',
      entity: 'series',
      entityId: series.id,
      summary: `Created the series "${title}" with ${rows.length} messages`,
      after: { title, parts: rows },
    });
    return ok({ id: series.id });
  } catch (e) {
    return failFrom(e, "Couldn't create the series.");
  }
}
