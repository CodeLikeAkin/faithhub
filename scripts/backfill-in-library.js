#!/usr/bin/env node
/**
 * backfill-in-library.js — run once, after supabase/migrations/declarations_in_library.sql.
 *
 * Sets declarations.in_library = false for every declaration that came from a
 * guest minister's message or a celebration / panel / tribute video, so the
 * declarations library serves Dad's and Mom's only. Everything else stays
 * true (the column's default).
 *
 * The guest / panel rules live in ONE place — lib/speakers.js — and this readsa
 * them from there rather than re-stating them in SQL, so the back-fill can't
 * drift from what Ask the Word and the admin chips decide about the same title.
 *
 *   node scripts/backfill-in-library.js --dry-run   # counts and a sample, writes nothing
 *   node scripts/backfill-in-library.js             # applies it
 *   node scripts/backfill-in-library.js --revert     # sets every row back to true
 *
 * Safe to re-run: it sets rows to the value they should have, so a second run
 * reports nothing to change. Re-run it if a sermon's title is corrected in
 * admin, or just rely on the pipeline, which sets the column for new messages.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const REVERT = process.argv.includes('--revert');
const CHUNK = 200;

// .env.local, the same file next dev reads.
const envPath = path.join(__dirname, '..', '.env.local');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  if (!line.includes('=') || line.trimStart().startsWith('#')) continue;
  const i = line.indexOf('=');
  process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.local.');
  process.exit(1);
}
const db = createClient(url, key);

// lib/speakers.js is an ES module with no relative imports of its own, so its
// two rules are read straight out of the file rather than duplicated here.
// If that file ever grows an import, this throws instead of guessing.
async function speakerRules() {
  const src = path.join(__dirname, '..', 'lib', 'speakers.js');
  if (/^\s*import\s/m.test(fs.readFileSync(src, 'utf8'))) {
    throw new Error('lib/speakers.js now has imports — load it through the bundler instead of importing it here.');
  }
  return import('file://' + src.replace(/\\/g, '/'));
}

const unescape = (t) => String(t || '').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

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

/** Set in_library on a list of declaration ids, in chunks the URL can carry. */
async function setFlag(ids, value) {
  let done = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { error } = await db.from('declarations').update({ in_library: value }).in('id', slice);
    if (error) throw new Error(`update: ${error.message}`);
    done += slice.length;
    process.stdout.write(`\r  ${done}/${ids.length}`);
  }
  if (ids.length) process.stdout.write('\n');
}

async function main() {
  // The column has to exist first — fail with the fix rather than a raw error.
  const probe = await db.from('declarations').select('id, in_library').limit(1);
  if (probe.error) {
    console.error(`Could not read declarations.in_library: ${probe.error.message}`);
    console.error('Run supabase/migrations/declarations_in_library.sql in the Supabase SQL editor first.');
    process.exitCode = 1;
    return;
  }

  if (REVERT) {
    const { data, error } = await db.from('declarations').select('id').eq('in_library', false);
    if (error) throw new Error(error.message);
    console.log(`Revert: ${data.length} row(s) currently false.`);
    if (DRY_RUN) return console.log('DRY RUN — nothing written.');
    await setFlag(data.map((d) => d.id), true);
    return console.log('All declarations are back in the library.');
  }

  const { detectSpeaker, isMultiVoice } = await speakerRules();

  const sermons = await allRows('sermons', 'id, title');
  const leftOut = sermons.filter((s) => {
    const title = unescape(s.title);
    return detectSpeaker(title).isGuest || isMultiVoice(title);
  });
  console.log(`${sermons.length} sermons; ${leftOut.length} are a guest's or a celebration/panel video.`);

  const byId = new Map(sermons.map((s) => [s.id, unescape(s.title)]));
  const leftOutIds = new Set(leftOut.map((s) => s.id));

  const decls = await allRows('declarations', 'id, sermon_id, in_library');
  const shouldBeFalse = decls.filter((d) => leftOutIds.has(d.sermon_id));
  const toFalse = shouldBeFalse.filter((d) => d.in_library !== false).map((d) => d.id);
  // Anything marked false whose sermon is no longer a guest's — a title fixed
  // in admin since the last run — goes back into the library.
  const toTrue = decls.filter((d) => d.in_library === false && !leftOutIds.has(d.sermon_id)).map((d) => d.id);

  console.log(`${decls.length} declarations; ${shouldBeFalse.length} belong to those messages.`);
  console.log(`  to set false: ${toFalse.length}`);
  console.log(`  to set true (title corrected since): ${toTrue.length}`);

  const sample = [...new Set(shouldBeFalse.map((d) => byId.get(d.sermon_id)))].slice(0, 8);
  if (sample.length) {
    console.log('\nMessages whose declarations leave the library:');
    for (const t of sample) console.log(`  - ${String(t).slice(0, 78)}`);
    if (leftOut.length > sample.length) console.log(`  … and ${leftOut.length - sample.length} more`);
  }

  if (DRY_RUN) return console.log('\nDRY RUN — nothing written.');
  if (!toFalse.length && !toTrue.length) return console.log('\nNothing to change.');

  console.log('');
  if (toFalse.length) await setFlag(toFalse, false);
  if (toTrue.length) await setFlag(toTrue, true);

  const { count } = await db.from('declarations').select('id', { count: 'exact', head: true }).eq('in_library', false);
  console.log(`Done. ${count} declaration(s) are now out of the library.`);
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exitCode = 1;
});
