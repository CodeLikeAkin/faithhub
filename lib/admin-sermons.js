// lib/admin-sermons.js
//
// Publishing, hiding and editing single messages, shared by the one-message
// and bulk /api/admin/sermons routes. Server-only; callers run
// adminApiGuard() first.

import { adminDb } from '@/lib/admin-db';
import { audit } from '@/lib/admin-api';

export const MAX_BULK = 100;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * Publish or hide messages. Either way the cached summary of every series they
 * belong to is cleared, so the series page writes a fresh one about the parts
 * visitors can actually see (/api/series-summary otherwise caches forever).
 * Returns the messages that changed and the series whose summary was cleared.
 */
export async function setPublished(ids, published) {
  const db = adminDb();
  const { data: rows, error } = await db.from('sermons').select('id, title, published').in('id', ids);
  if (error) throw error;

  const targets = (rows || []).filter((r) => r.published !== published);
  if (!targets.length) return { changed: [], series: [] };
  const targetIds = targets.map((r) => r.id);

  const { error: upErr } = await db.from('sermons').update({ published }).in('id', targetIds);
  if (upErr) throw upErr;

  const { data: links, error: linkErr } = await db
    .from('series_sermons')
    .select('series ( id, title, study_summary, suggested_questions )')
    .in('sermon_id', targetIds);
  if (linkErr) throw linkErr;
  const series = [...new Map((links || []).filter((l) => l.series).map((l) => [l.series.id, l.series])).values()];
  const withSummary = series.filter((s) => s.study_summary || s.suggested_questions);
  if (withSummary.length) {
    const { error: sumErr } = await db
      .from('series')
      .update({ study_summary: null, suggested_questions: null })
      .in('id', withSummary.map((s) => s.id));
    if (sumErr) throw sumErr;
  }

  const verb = published ? 'Published' : 'Hid';
  await audit({
    action: published ? 'sermon.publish' : 'sermon.unpublish',
    entity: 'sermon',
    entityId: targets.length === 1 ? targetIds[0] : null,
    summary:
      targets.length === 1
        ? `${verb} "${targets[0].title}"`
        : `${verb} ${plural(targets.length, 'message', 'messages')}`,
    before: {
      published: !published,
      sermons: targets.map((t) => ({ id: t.id, title: t.title })),
      // What the cleared summaries said, so they can be put back by hand.
      series_summaries: withSummary.map((s) => ({
        id: s.id,
        title: s.title,
        study_summary: s.study_summary,
        suggested_questions: s.suggested_questions,
      })),
    },
    after: { published, sermon_ids: targetIds },
  });

  return {
    changed: targets.map((t) => ({ id: t.id, title: t.title })),
    series: withSummary.map((s) => s.title),
  };
}

/** Load the fields the single-message edits compare against. */
export async function loadSermon(id) {
  const { data, error } = await adminDb()
    .from('sermons')
    .select('id, title, published, word_studies_none, declarations_none')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Rename a message. The worker keeps an edited title when it runs the message again. */
export async function renameSermon(before, title) {
  const { error } = await adminDb().from('sermons').update({ title }).eq('id', before.id);
  if (error) throw error;
  await audit({
    action: 'sermon.rename',
    entity: 'sermon',
    entityId: before.id,
    summary: `Renamed "${before.title}" to "${title}"`,
    before: { title: before.title },
    after: { title },
  });
}

/** Mark (or unmark) a message as explaining no Greek or Hebrew word. */
export async function setWordStudiesNone(before, value) {
  const { error } = await adminDb().from('sermons').update({ word_studies_none: value }).eq('id', before.id);
  if (error) throw error;
  await audit({
    action: value ? 'sermon.word_studies_none' : 'sermon.word_studies_needed',
    entity: 'sermon',
    entityId: before.id,
    summary: value
      ? `Marked "${before.title}" as needing no word studies`
      : `Took the "no word studies needed" mark off "${before.title}"`,
    before: { word_studies_none: before.word_studies_none },
    after: { word_studies_none: value },
  });
}

/** Mark (or unmark) a message as needing no declarations. */
export async function setDeclarationsNone(before, value) {
  const { error } = await adminDb().from('sermons').update({ declarations_none: value }).eq('id', before.id);
  if (error) throw error;
  await audit({
    action: value ? 'sermon.declarations_none' : 'sermon.declarations_needed',
    entity: 'sermon',
    entityId: before.id,
    summary: value
      ? `Marked "${before.title}" as needing no declarations`
      : `Took the "no declarations needed" mark off "${before.title}"`,
    before: { declarations_none: before.declarations_none },
    after: { declarations_none: value },
  });
}
