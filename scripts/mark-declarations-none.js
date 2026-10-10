#!/usr/bin/env node
/**
 * mark-declarations-none.js — run once, after supabase/migrations/admin_declarations_none.sql.
 *
 * Marks the messages that were decided (2026-10-10) to need no declarations,
 * so the admin stops listing them as missing:
 *   - 40 Days of Transformation sessions (40DOT, all years) and the April 2024
 *     "7 Days of Full Measures" sessions. Sermons ABOUT the event ("How To
 *     Prepare for 40 Days...", "Preparation Guide...") are ordinary messages
 *     and are left alone.
 *   - guest ministers' and celebration / panel videos outside a series. Their
 *     declarations would be kept off the Declarations page anyway (see
 *     declarations_in_library.sql). Guests IN a series are left alone: their
 *     declarations show on the series page.
 * Only messages with no declarations at all are touched. One History entry
 * lists every message marked, so it can be undone from there or with --revert.
 *
 *   node scripts/mark-declarations-none.js --dry-run   # lists them, writes nothing
 *   node scripts/mark-declarations-none.js             # marks them
 *   node scripts/mark-declarations-none.js --revert    # unmarks what the last run marked
 *
 * Safe to re-run: already-marked messages are skipped.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const REVERT = process.argv.includes('--revert');
const ACTION = 'sermon.declarations_none_bulk';

const envPath = path.join(__dirname, '..', '.env.local');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  if (!line.includes('=') || line.trimStart().startsWith('#')) continue;
  const i = line.indexOf('=');
  process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Same loader as backfill-in-library.js: lib/speakers.js has no imports of its own.
async function speakerRules() {
  const src = path.join(__dirname, '..', 'lib', 'speakers.js');
  if (/^\s*import\s/m.test(fs.readFileSync(src, 'utf8'))) {
    throw new Error('lib/speakers.js now has imports — load it through the bundler instead of importing it here.');
  }
  return import('file://' + src.replace(/\\/g, '/'));
}

async function allRows(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

const SESSION = /40\s*D(AYS|OT)\b|7 DAYS OF FULL MEASURES/i;
const ABOUT_THE_EVENT = /prepar/i;

async function setFlag(ids, value) {
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await db.from('sermons').update({ declarations_none: value }).in('id', ids.slice(i, i + 200));
    if (error) throw new Error(`update: ${error.message}`);
  }
}

async function revert() {
  const { data, error } = await db.from('admin_audit').select('id, after').eq('action', ACTION).order('at', { ascending: false }).limit(1);
  if (error) throw error;
  const ids = data?.[0]?.after?.sermon_ids || [];
  if (!ids.length) return console.log('Nothing to revert.');
  if (DRY_RUN) return console.log(`Would unmark ${ids.length} messages.`);
  await setFlag(ids, false);
  await db.from('admin_audit').insert({
    action: 'sermon.declarations_needed_bulk',
    entity: 'sermon',
    summary: `Took the "no declarations needed" mark off ${ids.length} messages (undid the bulk mark)`,
    before: { declarations_none: true },
    after: { declarations_none: false, sermon_ids: ids },
  });
  console.log(`Unmarked ${ids.length} messages.`);
}

async function main() {
  if (REVERT) return revert();
  const { detectSpeaker, isMultiVoice } = await speakerRules();
  const [sermons, links, decl] = await Promise.all([
    allRows('sermons', 'id, title, declarations_none'),
    allRows('series_sermons', 'sermon_id'),
    allRows('declarations', 'sermon_id'),
  ]);
  const inSeries = new Set(links.map((l) => l.sermon_id));
  const hasDecl = new Set(decl.map((d) => d.sermon_id));
  const open = sermons.filter((s) => !hasDecl.has(s.id) && !s.declarations_none);

  const sessions = open.filter((s) => SESSION.test(s.title) && !ABOUT_THE_EVENT.test(s.title));
  const guests = open.filter(
    (s) => !sessions.includes(s) && !inSeries.has(s.id) && (isMultiVoice(s.title) || detectSpeaker(s.title).isGuest)
  );

  console.log(`40 Days / 7 Days sessions: ${sessions.length}`);
  console.log(`Guests and celebration videos outside a series: ${guests.length}`);
  for (const s of guests) console.log(`  guest  ${s.title}`);
  const targets = [...sessions, ...guests];
  if (DRY_RUN || !targets.length) return console.log(DRY_RUN ? `\nDry run: would mark ${targets.length}.` : 'Nothing to mark.');

  await setFlag(targets.map((s) => s.id), true);
  const { error } = await db.from('admin_audit').insert({
    action: ACTION,
    entity: 'sermon',
    summary: `Marked ${targets.length} messages as needing no declarations (${sessions.length} 40 Days / 7 Days sessions, ${guests.length} guest or celebration videos outside a series)`,
    before: { declarations_none: false },
    after: { declarations_none: true, sermon_ids: targets.map((s) => s.id), titles: targets.map((s) => s.title) },
  });
  if (error) throw error;
  console.log(`\nMarked ${targets.length}.`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
