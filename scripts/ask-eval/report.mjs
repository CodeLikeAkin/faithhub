// Turns a results/<label>.json run (plus an optional hand review and a
// findings file) into one self-contained HTML scorecard.
//
//   node scripts/ask-eval/report.mjs --label baseline --out <file.html>
//   node scripts/ask-eval/report.mjs --label after-fix --compare baseline --out <file.html>
//
// results/review-<label>.json : { "A1": { "verdict": "FAIL", "why": "..." }, ... }  (turn ids like "G1.2")
// results/findings-<label>.json: [{ "title", "body", "evidence" }]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const LABEL = arg('label', 'baseline');
const COMPARE = arg('compare', '');
const OUT = arg('out', path.join(here, 'results', `${LABEL}.html`));
const readJson = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);

const run = readJson(path.join(here, 'results', `${LABEL}.json`));
const review = readJson(path.join(here, 'results', `review-${LABEL}.json`), {});
const findings = readJson(path.join(here, 'results', `findings-${LABEL}.json`), []);
const prior = COMPARE ? readJson(path.join(here, 'results', `${COMPARE}.json`)) : null;
const priorReview = COMPARE ? readJson(path.join(here, 'results', `review-${COMPARE}.json`), {}) : {};

const GROUPS = {
  A: 'A named preacher', B: 'Half-remembered moments', C: 'Teaching topics', D: 'A specific message',
  E: 'Scripture', F: 'Voice-typing and spelling', G: 'Follow-up questions', H: 'Not covered',
  I: 'Unusual phrasing', J: 'Misuse',
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clean = (t) => String(t || '').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

function rows(r) {
  return r.results.flatMap((c) =>
    c.turns.map((t, i) => {
      const id = c.turns.length > 1 ? `${c.id}.${i + 1}` : c.id;
      return { id, caseId: c.id, group: c.group, note: c.note, ...t };
    })
  );
}
const finalVerdict = (row, rev) => rev[row.id]?.verdict || row.verdict;

const all = rows(run);
const priorById = prior ? Object.fromEntries(rows(prior).map((r) => [r.id, finalVerdict(r, priorReview)])) : {};
const count = (list, v) => list.filter((r) => finalVerdict(r, review) === v).length;

function answerHtml(answer, map) {
  return esc(answer || '')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(\d+)\]/g, (m, n) => {
      const s = map?.[n];
      const title = s ? `${clean(s.sermon_title)}${s.speaker ? ' — ' + s.speaker : ''}` : 'missing source';
      return `<sup class="cite${s ? '' : ' bad'}" title="${esc(title)}">${n}</sup>`;
    })
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function sourcesHtml(map) {
  const list = Object.entries(map || {});
  if (!list.length) return '<p class="muted">No sources.</p>';
  return `<ol class="sources">${list
    .map(([n, s]) => `<li value="${n}"><span>${esc(clean(s.sermon_title))}</span>${s.speaker ? `<em>${esc(s.speaker)}</em>` : ''}</li>`)
    .join('')}</ol>`;
}

const pill = (v) => `<span class="pill ${v.toLowerCase()}">${v === 'PARTIAL' ? 'Partial' : v === 'PASS' ? 'Pass' : 'Fail'}</span>`;

function rowHtml(r) {
  const v = finalVerdict(r, review);
  const rev = review[r.id];
  const was = priorById[r.id];
  const shown = r.q.length > 220 ? r.q.slice(0, 220) + '…' : r.q;
  const search = r.debug?.search ? `<div class="search"><span class="label">Searched for</span> <q>${esc(r.debug.search)}</q> <span class="mode">${esc(r.debug.mode)}</span></div>` : '';
  return `<details class="case" data-v="${v}" data-g="${r.group}">
  <summary>
    <span class="cid">${r.id}</span>
    <span class="qtext">${esc(shown)}${r.note ? `<small>${esc(r.note)}</small>` : ''}</span>
    <span class="verdicts">${was && was !== v ? `<span class="was">${pill(was)}<span class="arrow">→</span></span>` : ''}${pill(v)}</span>
  </summary>
  <div class="body">
    ${rev?.why ? `<p class="why">${esc(rev.why)}</p>` : ''}
    ${search}
    ${(r.notes || []).length ? `<ul class="notes">${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    ${r.status !== 200 ? `<p class="muted">HTTP ${r.status}${r.error ? ' — ' + esc(String(r.error).slice(0, 200)) : ''}</p>` : `
    <div class="answer">${answerHtml(r.answer, r.segmentMap)}</div>
    <details class="src"><summary>${Object.keys(r.segmentMap || {}).length} sources</summary>${sourcesHtml(r.segmentMap)}</details>`}
    <p class="meta">${((r.ms || 0) / 1000).toFixed(1)}s${r.debug?.weakGrounding ? ' · flagged as weak match' : ''}</p>
  </div>
</details>`;
}

const groupStats = Object.entries(GROUPS).map(([g, name]) => {
  const list = all.filter((r) => r.group === g);
  return { g, name, n: list.length, pass: count(list, 'PASS'), partial: count(list, 'PARTIAL'), fail: count(list, 'FAIL') };
}).filter((s) => s.n);

const total = all.length;
const pass = count(all, 'PASS');
const partial = count(all, 'PARTIAL');
const fail = count(all, 'FAIL');
const when = new Date(run.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

const html = `<title>Ask the Word Scorecard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500;6..72,600&family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400;500&display=swap">
<style>
/* Layout: one reading column — verdict summary, then findings, then every question as an expandable row. */
:root {
  --bg: #F6F8FB; --surface: #FFFFFF; --ink: #17233B; --text: #3D4757; --muted: #6B7585;
  --line: #DCE3EC; --navy: #173A68; --sky: #EAF2FB;
  --pass: #2F7D32; --pass-bg: #E5F2E3; --partial: #8A5A00; --partial-bg: #FBEFD6; --fail: #B3261E; --fail-bg: #FBE4E2;
  --display: "Newsreader", Georgia, Cambria, serif;
  --body: "Roboto", system-ui, sans-serif;
  --mono: "Roboto Mono", ui-monospace, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #0E1726; --surface: #152238; --ink: #E8EEF7; --text: #C3CCD9; --muted: #8C98AA;
  --line: #26354D; --navy: #8FB4E8; --sky: #1B2C47;
  --pass: #8BD18E; --pass-bg: #1C3322; --partial: #F0C46A; --partial-bg: #3A2E14; --fail: #F2918A; --fail-bg: #3D1E1C;
  color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #0E1726; --surface: #152238; --ink: #E8EEF7; --text: #C3CCD9; --muted: #8C98AA;
  --line: #26354D; --navy: #8FB4E8; --sky: #1B2C47;
  --pass: #8BD18E; --pass-bg: #1C3322; --partial: #F0C46A; --partial-bg: #3A2E14; --fail: #F2918A; --fail-bg: #3D1E1C;
  color-scheme: dark; }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--text); font: 15px/1.6 var(--body); }
.wrap { max-width: 920px; margin: 0 auto; padding-inline: 16px; padding-block: 40px 80px; display: grid; gap: 40px; }
h1, h2 { font-family: var(--display); color: var(--ink); font-weight: 600; text-wrap: balance; margin: 0; }
h1 { font-size: clamp(30px, 5vw, 42px); line-height: 1.1; }
h2 { font-size: 24px; line-height: 1.2; }
.eyebrow { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--navy); font-weight: 500; }
.lede { max-width: 65ch; margin: 12px 0 0; }
header { display: grid; gap: 4px; }
.score { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; }
.score div { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; }
.score b { display: block; font: 600 34px/1 var(--display); color: var(--ink); font-variant-numeric: tabular-nums; }
.score span { font-size: 13px; color: var(--muted); }
.score .p b { color: var(--pass); } .score .pa b { color: var(--partial); } .score .f b { color: var(--fail); }
.groups { display: grid; gap: 8px; }
.grow { display: grid; grid-template-columns: minmax(0, 200px) minmax(0, 1fr) 64px; gap: 12px; align-items: center; font-size: 14px; }
.bar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; background: var(--line); }
.bar i { display: block; height: 100%; }
.bar .p { background: var(--pass); } .bar .pa { background: var(--partial); } .bar .f { background: var(--fail); }
.grow .n { font: 13px var(--mono); color: var(--muted); text-align: right; font-variant-numeric: tabular-nums; }
.findings { display: grid; gap: 14px; counter-reset: f; }
.finding { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 18px 20px; }
.finding h3 { margin: 0 0 6px; font: 600 17px/1.35 var(--body); color: var(--ink); }
.finding p { margin: 0; max-width: 70ch; }
.finding .ev { margin-top: 10px; font-size: 13px; color: var(--muted); border-top: 1px dashed var(--line); padding-top: 10px; }
.filters { display: flex; flex-wrap: wrap; gap: 8px; }
.filters button { font: 500 13px var(--body); padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); color: var(--text); cursor: pointer; }
.filters button[aria-pressed="true"] { background: var(--navy); border-color: var(--navy); color: var(--bg); }
.filters button:focus-visible, summary:focus-visible { outline: 2px solid var(--navy); outline-offset: 2px; }
.cases { display: grid; gap: 6px; }
.gtitle { margin: 18px 0 4px; font: 600 13px var(--body); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.case { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; }
.case > summary { list-style: none; cursor: pointer; display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; gap: 12px; align-items: start; padding: 12px 14px; }
.case > summary::-webkit-details-marker { display: none; }
.cid { font: 500 13px var(--mono); color: var(--muted); padding-top: 2px; }
.qtext { color: var(--ink); min-width: 0; overflow-wrap: anywhere; }
.qtext small { display: block; color: var(--muted); font-size: 13px; }
.verdicts { display: flex; align-items: center; gap: 6px; }
.was { display: flex; align-items: center; gap: 6px; opacity: .7; }
.arrow { color: var(--muted); }
.pill { font: 500 12px var(--body); padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
.pill.pass { background: var(--pass-bg); color: var(--pass); }
.pill.partial { background: var(--partial-bg); color: var(--partial); }
.pill.fail { background: var(--fail-bg); color: var(--fail); }
.body { padding: 0 14px 16px 74px; display: grid; gap: 10px; min-width: 0; }
.why { margin: 0; font-weight: 500; color: var(--ink); }
.search { font-size: 14px; }
.search q { font-family: var(--mono); font-size: 13px; background: var(--sky); padding: 1px 6px; border-radius: 4px; quotes: none; }
.label { color: var(--muted); }
.mode { font-size: 12px; color: var(--muted); margin-left: 4px; }
.notes { margin: 0; padding-left: 18px; font-size: 14px; color: var(--muted); }
.answer { border-left: 3px solid var(--line); padding-left: 14px; font-size: 14.5px; max-width: 70ch; }
.answer p { margin: 0 0 8px; }
.cite { font: 500 11px var(--mono); color: var(--navy); margin-left: 1px; cursor: help; }
.cite.bad { color: var(--fail); }
.src summary { cursor: pointer; font-size: 13px; color: var(--navy); }
.sources { margin: 8px 0 0; padding-left: 24px; font-size: 13px; display: grid; gap: 2px; }
.sources em { color: var(--partial); font-style: normal; margin-left: 6px; }
.meta { margin: 0; font-size: 12px; color: var(--muted); }
.muted { color: var(--muted); }
@media (max-width: 560px) {
  .grow { grid-template-columns: minmax(0, 1fr) 56px; } .grow .bar { grid-column: 1 / -1; grid-row: 2; }
  .case > summary { grid-template-columns: 40px minmax(0, 1fr); } .verdicts { grid-column: 2; }
  .body { padding-left: 14px; }
}
</style>
<div class="wrap">
  <header>
    <span class="eyebrow">FaithHub · Ask the Word · ${esc(run.label)} run</span>
    <h1>Ask the Word Scorecard</h1>
    <p class="lede">${total} answers from ${run.results.length} questions and conversations, asked of the local app on ${esc(when)} the way the Ask the Word page asks them. Each answer was checked against the right message, looked up in the transcripts beforehand, then read and graded by hand.${prior ? ` Arrows show the change from the ${esc(prior.label)} run.` : ''}</p>
  </header>

  <section class="score" aria-label="Totals">
    <div class="p"><b>${pass}</b><span>Pass</span></div>
    <div class="pa"><b>${partial}</b><span>Partial</span></div>
    <div class="f"><b>${fail}</b><span>Fail</span></div>
    <div><b>${Math.round((100 * pass) / total)}%</b><span>fully correct</span></div>
  </section>

  <section class="groups" aria-label="By question type">
    <h2>By question type</h2>
    ${groupStats.map((s) => `<div class="grow"><span>${s.g} · ${esc(s.name)}</span><span class="bar" role="img" aria-label="${s.pass} pass, ${s.partial} partial, ${s.fail} fail">${s.pass ? `<i class="p" style="width:${(100 * s.pass) / s.n}%"></i>` : ''}${s.partial ? `<i class="pa" style="width:${(100 * s.partial) / s.n}%"></i>` : ''}${s.fail ? `<i class="f" style="width:${(100 * s.fail) / s.n}%"></i>` : ''}</span><span class="n">${s.pass}/${s.n}</span></div>`).join('')}
  </section>

  ${findings.length ? `<section class="findings">
    <h2>${prior ? 'What changed' : "What's going wrong"}</h2>
    ${findings.map((f) => `<article class="finding"><h3>${esc(f.title)}</h3><p>${esc(f.body)}</p>${f.evidence ? `<p class="ev">${esc(f.evidence)}</p>` : ''}</article>`).join('')}
  </section>` : ''}

  <section>
    <h2>Every question</h2>
    <div class="filters" role="group" aria-label="Show">
      <button type="button" id="f-all" data-f="all" aria-pressed="true">All</button>
      <button type="button" id="f-fail" data-f="FAIL" aria-pressed="false">Fail</button>
      <button type="button" id="f-partial" data-f="PARTIAL" aria-pressed="false">Partial</button>
      <button type="button" id="f-pass" data-f="PASS" aria-pressed="false">Pass</button>
    </div>
    <div class="cases">
      ${Object.entries(GROUPS).map(([g, name]) => {
        const list = all.filter((r) => r.group === g);
        return list.length ? `<p class="gtitle" data-g="${g}">${g} · ${esc(name)}</p>${list.map(rowHtml).join('')}` : '';
      }).join('')}
    </div>
  </section>
</div>
<script>
const btns = document.querySelectorAll('.filters button');
btns.forEach((b) => b.addEventListener('click', () => {
  btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  const f = b.dataset.f;
  document.querySelectorAll('.case').forEach((c) => { c.hidden = f !== 'all' && c.dataset.v !== f; });
  document.querySelectorAll('.gtitle').forEach((t) => {
    t.hidden = ![...document.querySelectorAll('.case[data-g="' + t.dataset.g + '"]')].some((c) => !c.hidden);
  });
}));
</script>
`;

fs.writeFileSync(OUT, html);
console.log(`Wrote ${OUT} — ${pass} pass · ${partial} partial · ${fail} fail`);
