// Ask the Word test runner. Asks every case in questions.mjs against a running
// dev server, the way the /ask page does, and auto-scores what it can check.
//
//   node scripts/ask-eval/run.mjs                       # all cases → results/baseline.json
//   node scripts/ask-eval/run.mjs --label after-fix     # → results/after-fix.json
//   node scripts/ask-eval/run.mjs --only A1,G1 --base http://localhost:3000
//
// Run from faithhub/ (reads .env.local for the scripture ground truth). The
// route's X-Ask-Debug header (development only) supplies the search rewrite.
// Each turn sends { message, chatHistory } — the history in the same shape
// lib/studies.js builds — so the follow-up cases measure memory as soon as the
// route reads it.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CASES } from './questions.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const BASE = arg('base', 'http://localhost:3000');
const LABEL = arg('label', 'baseline');
const ONLY = arg('only', '') ? new Set(arg('only').split(',')) : null;
// /api/ask allows 8 a minute per device; stay just under it.
const PACE_MS = Number(arg('pace', 7800));

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })
);

const scriptureCache = new Map();
async function sermonsOpening(ref) {
  if (scriptureCache.has(ref)) return scriptureCache.get(ref);
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/sermon_scriptures?select=sermon_id&reference=ilike.${encodeURIComponent(ref + '*')}`;
  const res = await fetch(url, { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } });
  const ids = new Set((await res.json()).map((r) => r.sermon_id));
  scriptureCache.set(ref, ids);
  return ids;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastStart = 0;
const clientId = `ask-eval-${Date.now()}`;

async function ask(message, chatHistory) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = lastStart + PACE_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastStart = Date.now();
    const t0 = Date.now();
    let res;
    try {
      res = await fetch(`${BASE}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client-Id': clientId },
        body: JSON.stringify({ message, chatHistory }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (err) {
      return { status: 0, error: err.message, ms: Date.now() - t0 };
    }
    if (res.status === 429) { await sleep(20_000); continue; }
    if (res.status === 503 && attempt === 0) { await sleep(1500); continue; } // the page retries once too
    const debugRaw = res.headers.get('x-ask-debug');
    const debug = debugRaw ? JSON.parse(decodeURIComponent(debugRaw)) : null;
    const text = await res.text();
    const ms = Date.now() - t0;
    if (!res.ok) {
      let msg = text;
      try { msg = JSON.parse(text).message; } catch {}
      return { status: res.status, error: msg, debug, ms };
    }
    const nl = text.indexOf('\n');
    let segmentMap = {};
    let body = text;
    if (text.startsWith('SEGMENT_MAP:')) {
      try { segmentMap = JSON.parse(text.slice('SEGMENT_MAP:'.length, nl)); } catch {}
      body = text.slice(nl + 1);
    }
    const m = [...body.matchAll(/SUG{1,2}ESTIONS?\s*:/gi)].pop();
    let suggestions = [];
    let answer = body;
    if (m) {
      answer = body.slice(0, m.index).trim();
      try { suggestions = JSON.parse(body.slice(m.index + m[0].length).trim()); } catch {}
    }
    return { status: res.status, debug, segmentMap, answer, suggestions, ms };
  }
  return { status: 429, error: 'rate limited after retries' };
}

const PETER_RE = /\b(?:Rev(?:erend|d)?\.?\s*Peter|Dad|Daddy)\b/i;
const REFUSE_RE =
  /\b(?:do(?:es)?n['’]t (?:clearly |directly |specifically )?(?:address|cover|speak|mention|discuss|teach|talk)|(?:don['’]t|didn['’]t|couldn['’]t|could not|can['’]t|cannot) (?:find|see|locate)|not (?:clearly |directly )?(?:addressed|covered|mentioned)|no (?:message|segment|teaching|record)s?\b|isn['’]t (?:covered|addressed)|outside (?:of )?(?:what|the))/i;

function citedNumbers(answer) {
  const out = new Set();
  for (const m of (answer || '').matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)) {
    for (const n of m[1].split(',')) out.add(Number(n.trim()));
  }
  return out;
}

async function score(turn, r) {
  const e = turn.expect || {};
  const checks = {};
  const notes = [];

  if (e.status) {
    checks.status = r.status === e.status;
    return { verdict: checks.status ? 'PASS' : 'FAIL', checks, notes };
  }
  if (r.status !== 200) {
    notes.push(`HTTP ${r.status}: ${r.error}`);
    return { verdict: 'FAIL', checks: { http: false }, notes };
  }

  const map = r.segmentMap || {};
  const entries = Object.entries(map).map(([n, s]) => ({ n: Number(n), ...s }));
  const cited = citedNumbers(r.answer);
  const invalid = [...cited].filter((n) => !map[n]);
  checks.citationsValid = invalid.length === 0;
  if (invalid.length) notes.push(`cites [${invalid.join(',')}] which don't exist`);

  if (e.sermon) {
    const res = e.sermon.map((s) => new RegExp(s, 'i'));
    const hit = (s) => res.some((re) => re.test(s.sermon_title || ''));
    const retrieved = entries.filter(hit);
    checks.retrieved = retrieved.length > 0;
    checks.cited = retrieved.some((s) => cited.has(s.n));
    if (retrieved.length) notes.push(`right message at segment #${Math.min(...retrieved.map((s) => s.n))} of ${entries.length}`);
    else notes.push(`right message not among ${entries.length} segments`);
  }
  if (e.scripture) {
    const ids = await sermonsOpening(e.scripture);
    const retrieved = entries.filter((s) => ids.has(s.sermon_id));
    checks.retrieved = retrieved.length > 0;
    checks.cited = retrieved.some((s) => cited.has(s.n));
    checks.namesVerse = new RegExp(e.scripture.replace(/\s+/g, '\\s*'), 'i').test(r.answer);
    notes.push(`${retrieved.length}/${entries.length} segments from messages that opened ${e.scripture} (${ids.size} such messages)`);
  }
  if (e.speaker) checks.speakerCredited = new RegExp(e.speaker, 'i').test(r.answer);
  if (e.notPeter) {
    // A sentence that credits Rev. Peter while every segment it cites is
    // someone else's (or a multi-voice video) is a misattribution.
    const bad = (r.answer || '').split(/(?<=[.!?])\s+/).filter((sent) => {
      const ns = [...citedNumbers(sent)].filter((n) => map[n]);
      return ns.length && PETER_RE.test(sent) && ns.every((n) => map[n].speaker);
    });
    checks.noMisattribution = bad.length === 0;
    if (bad.length) notes.push(`credits Rev. Peter for someone else's words: "${bad[0].slice(0, 140)}"`);
  }
  if (e.refuse) {
    checks.saysNotCovered = REFUSE_RE.test((r.answer || '').slice(0, 500)) || entries.length === 0;
  }
  if (e.topic) {
    const re = new RegExp(e.topic, 'i');
    checks.onTopic = re.test(r.answer || '') && re.test(r.debug?.search || r.answer || '');
    if (r.debug && !re.test(r.debug.search)) notes.push(`searched "${r.debug.search}" — lost the topic`);
  }
  if (e.noLeak) checks.noLeak = !/═══|SOURCING —|CITATION RULES|RESPONSE SHAPE/.test(r.answer || '');
  if (!e.refuse && !e.noLeak) checks.hasCitations = cited.size > 0;

  // The check that decides the case; the rest only take it down to PARTIAL.
  const primary = e.sermon || e.scripture ? 'retrieved' : e.refuse ? 'saysNotCovered' : e.topic ? 'onTopic' : e.noLeak ? 'noLeak' : 'hasCitations';
  const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  const verdict = !checks[primary] ? 'FAIL' : failed.length ? 'PARTIAL' : 'PASS';
  return { verdict, checks, notes, failed };
}

const results = [];
const cases = CASES.filter((c) => !ONLY || ONLY.has(c.id));
console.log(`Asking ${cases.length} cases against ${BASE} (label: ${LABEL})\n`);

for (const c of cases) {
  const turns = c.turns || [{ q: c.q, expect: c.expect }];
  const history = [];
  const out = { id: c.id, group: c.group, note: c.note || null, turns: [] };
  for (const [i, t] of turns.entries()) {
    const r = await ask(t.q, [...history]);
    const s = await score(t, r);
    out.turns.push({ q: t.q, expect: t.expect, ...r, ...s });
    if (r.status === 200 && r.answer) {
      // Same shape as lib/studies.js historyFor(): the answer's cited messages ride along.
      const sermons = new Map();
      for (const n of citedNumbers(r.answer)) {
        const s = r.segmentMap?.[n];
        if (s?.sermon_id && !sermons.has(s.sermon_id)) sermons.set(s.sermon_id, { id: s.sermon_id, title: s.sermon_title });
      }
      history.push({ role: 'user', text: t.q }, { role: 'ai', text: r.answer, sermons: [...sermons.values()].slice(0, 6) });
    }
    const label = turns.length > 1 ? `${c.id}.${i + 1}` : c.id;
    console.log(
      `${label.padEnd(6)} ${s.verdict.padEnd(8)} ${String(r.ms || 0).padStart(6)}ms  ` +
      `[${r.debug?.mode || '-'}] "${(r.debug?.search || '').slice(0, 70)}"` +
      (r.debug?.scope ? ` {${r.debug.scope.kind}: ${r.debug.scope.label}${r.debug.scope.missed ? ' — MISSED' : ''}}` : '') +
      (s.failed?.length ? `  ✗ ${s.failed.join(', ')}` : '')
    );
  }
  results.push(out);
  fs.mkdirSync(path.join(here, 'results'), { recursive: true });
  fs.writeFileSync(path.join(here, 'results', `${LABEL}.json`), JSON.stringify({ label: LABEL, base: BASE, at: new Date().toISOString(), results }, null, 2));
}

const all = results.flatMap((r) => r.turns);
const tally = (v) => all.filter((t) => t.verdict === v).length;
console.log(`\n${tally('PASS')} pass · ${tally('PARTIAL')} partial · ${tally('FAIL')} fail  (of ${all.length} answers)`);
console.log(`Saved scripts/ask-eval/results/${LABEL}.json`);
