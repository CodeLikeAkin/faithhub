import { adminApiGuard } from '@/lib/admin-auth';
import { adminDb } from '@/lib/admin-db';
import { UUID_RE, audit, fail, failFrom, ok, readJson } from '@/lib/admin-api';
import { syncSeriesTotals } from '@/lib/admin-series-db';
import { gapClosingMoves } from '@/lib/admin-parts';

export const dynamic = 'force-dynamic';

const validPart = (n) => Number.isInteger(n) && n >= 1 && n <= 999;

async function seriesTitle(id) {
  const { data } = await adminDb().from('series').select('title').eq('id', id).maybeSingle();
  return data?.title || null;
}

/** POST { sermon_id, part_number } -> add a message that is in no series yet. */
export async function POST(req, { params }) {
  const denied = adminApiGuard(req);
  if (denied) return denied;
  if (!UUID_RE.test(params.id)) return fail('Unknown series.', 404);

  try {
    const { sermon_id, part_number } = await readJson(req);
    if (!UUID_RE.test(sermon_id || '')) return fail('Unknown message.');
    if (!validPart(part_number)) return fail('Use a part number from 1 to 999.');

    const title = await seriesTitle(params.id);
    if (!title) return fail('Unknown series.', 404);

    const db = adminDb();
    const [{ data: sermon }, { data: taken }] = await Promise.all([
      db.from('sermons').select('id, title').eq('id', sermon_id).maybeSingle(),
      db.from('series_sermons').select('series_id').eq('sermon_id', sermon_id),
    ]);
    if (!sermon) return fail('Unknown message.');
    if (taken?.length) return fail('That message is already in a series. Remove it there first.');

    const { error } = await db.from('series_sermons').insert([{ series_id: params.id, sermon_id, part_number }]);
    if (error) throw error;
    await syncSeriesTotals(params.id);
    await audit({
      action: 'series.add_part',
      entity: 'series',
      entityId: params.id,
      summary: `Added "${sermon.title}" to "${title}" as part ${part_number}`,
      after: { sermon_id, part_number },
    });
    return ok();
  } catch (e) {
    return failFrom(e, "Couldn't add it to the series.");
  }
}

/** PATCH { parts: [{ sermon_id, part_number }] } -> renumber parts of this series. */
export async function PATCH(req, { params }) {
  const denied = adminApiGuard(req);
  if (denied) return denied;
  if (!UUID_RE.test(params.id)) return fail('Unknown series.', 404);

  try {
    const { parts } = await readJson(req);
    if (!Array.isArray(parts) || !parts.length || parts.length > 200) return fail('Nothing to save.');
    if (parts.some((p) => !UUID_RE.test(p.sermon_id || '') || !validPart(p.part_number))) {
      return fail('Every part number must be from 1 to 999.');
    }

    const title = await seriesTitle(params.id);
    if (!title) return fail('Unknown series.', 404);

    const db = adminDb();
    const { data: current, error } = await db
      .from('series_sermons')
      .select('id, sermon_id, part_number')
      .eq('series_id', params.id);
    if (error) throw error;
    const bySermon = new Map((current || []).map((r) => [r.sermon_id, r]));

    const changes = parts.filter((p) => bySermon.has(p.sermon_id) && bySermon.get(p.sermon_id).part_number !== p.part_number);
    for (const p of changes) {
      const { error: e } = await db.from('series_sermons').update({ part_number: p.part_number }).eq('id', bySermon.get(p.sermon_id).id);
      if (e) throw e;
    }
    if (changes.length) {
      await syncSeriesTotals(params.id);
      await audit({
        action: 'series.renumber',
        entity: 'series',
        entityId: params.id,
        summary: `Renumbered ${changes.length} ${changes.length === 1 ? 'part' : 'parts'} of "${title}"`,
        before: changes.map((p) => ({ sermon_id: p.sermon_id, part_number: bySermon.get(p.sermon_id).part_number })),
        after: changes,
      });
    }
    return ok({ changed: changes.length });
  } catch (e) {
    return failFrom(e, "Couldn't save the part numbers.");
  }
}

/** DELETE { sermon_id } -> take a message out of this series (it then leaves the catalog). */
export async function DELETE(req, { params }) {
  const denied = adminApiGuard(req);
  if (denied) return denied;
  if (!UUID_RE.test(params.id)) return fail('Unknown series.', 404);

  try {
    const { sermon_id } = await readJson(req);
    if (!UUID_RE.test(sermon_id || '')) return fail('Unknown message.');
    const title = await seriesTitle(params.id);
    if (!title) return fail('Unknown series.', 404);

    const db = adminDb();
    const { data: link } = await db
      .from('series_sermons')
      .select('id, part_number, sermons ( title )')
      .eq('series_id', params.id)
      .eq('sermon_id', sermon_id)
      .maybeSingle();
    if (!link) return fail('That message is not in this series.');

    const { error } = await db.from('series_sermons').delete().eq('id', link.id);
    if (error) throw error;

    // Close the hole it leaves, so removing the first six of 19 leaves 1 to 13, not 7 to 19.
    const { data: rest, error: restError } = await db.from('series_sermons').select('id, part_number').eq('series_id', params.id);
    if (restError) throw restError;
    const moves = gapClosingMoves(rest || [], link.part_number);
    for (const m of moves) {
      const { error: e } = await db.from('series_sermons').update({ part_number: m.to }).eq('id', m.id);
      if (e) throw e;
    }

    await syncSeriesTotals(params.id);
    await audit({
      action: 'series.remove_part',
      entity: 'series',
      entityId: params.id,
      summary:
        `Took "${link.sermons?.title || sermon_id}" (part ${link.part_number}) out of "${title}"` +
        (moves.length ? `, and moved ${moves.length} later ${moves.length === 1 ? 'part' : 'parts'} up by one` : ''),
      before: { sermon_id, part_number: link.part_number },
      after: moves.length ? { renumbered: moves.map(({ from, to }) => ({ from, to })) } : null,
    });
    return ok({ ok: true, moved: moves.length });
  } catch (e) {
    return failFrom(e, "Couldn't remove it from the series.");
  }
}
