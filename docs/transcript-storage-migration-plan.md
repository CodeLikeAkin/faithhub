# Moving transcripts out of the database — plan and handoff

**Written:** 2026-10-02
**Status:** agreed, not started
**Why it exists:** the Supabase database is over its free-plan limit. This plan frees ~78 MB
permanently by moving sermon transcripts to file storage. It is written so a new session can
pick it up cold.

---

## 1. The problem, in plain terms

The Supabase database is at **510 MB of a 500 MB free-plan limit**. Over-quota free projects can
be switched to **read-only**, which would mean: the website still works for visitors, but nothing
new can be saved — no new sermons from the pipeline, no admin edits, no feedback.

Measured 2026-10-02:

| Table | Total | Of which indexes | Rows |
|---|---|---|---|
| `sermon_segments` | 356 MB | 182 MB | 39,511 |
| `sermons` | 80 MB | 1.5 MB (so ~78 MB is transcript text) | 741 |
| `declarations` | 45 MB | 29 MB | 6,740 |
| everything else | ~29 MB | — | — |

This is not junk. It is the corpus plus the search machinery. Every sermon is split into ~53
searchable passages, each with a 384-number embedding and a full-text search vector, and the two
big indexes on top are what make Ask the Word fast.

**Each new sermon adds roughly 650 KB.** At the current rate (741 sermons since 2022, ~185/year)
that is **120–150 MB a year**. No one-off cleanup fixes this permanently.

### Options considered

- **A — Upgrade to Pro** ($25/month, 8 GB). Solves it for years, no work, no risk. Still the
  recommended option if the budget allows.
- **B — Compact and rebuild indexes.** Recovers 50–80 MB of waste. Buys 4–6 months. Brief downtime.
  Not chosen now, but step 7 below uses the same technique on one small table.
- **C — Move transcripts to file storage.** ~78 MB, permanently, and that part stops growing.
  **This is what we are doing.**

Even after C, `sermon_segments` keeps growing at ~120 MB/year. C buys roughly a year, not forever.

### Why C is safe in principle

**The live website never reads a transcript.** Verified by grep across `app/`, `components/`
and `lib/`: there is not one select of `transcript` or `transcript_segments` on any visitor-facing
path. Visitors read `sermon_segments`. Only the pipeline opens transcripts, and only while
processing a sermon.

Supabase **File storage is 0 of 1 GB used** — completely empty. Transcripts are whole documents
fetched one at a time, which is exactly what it is for.

---

## 2. The critical risk — read this before touching anything

**You cannot simply NULL the `transcript` column.** There are **23 presence-check filters**
across 9 files that ask the database "which sermons have a transcript?" like this:

```js
.not('transcript', 'is', null).neq('transcript', '')
```

If the column is emptied, every one of these starts reporting that **no sermon has a transcript**.
The pipeline would either skip everything or try to re-transcribe all 741 sermons from YouTube.
The admin readiness dashboard would show the whole library as unprocessed.

| File | Filters |
|---|---|
| `.claude/faithhub-pipeline/run-pipeline.js` | 7 |
| `.claude/faithhub-pipeline/lib/supabase.js` | 3 |
| `extract-scriptures-run.js`, `extract-word-studies-run.js`, `fetch-batch.js`, `generate-notes-run.js`, `renew-notes.js` | 2 each |
| `faithhub/lib/admin-dashboard.js` | 2 |
| `backfill-embeddings.js` | 1 |

**The fix:** add a small marker column first — `transcript_chars int` (4 bytes per row, ~3 KB for
the whole table) — backfill it from the existing data, and switch all 23 filters to use it
(`.gt('transcript_chars', 0)`). This is an independently safe change that can ship and run for
days before anything is deleted.

This step was not in the original estimate. It is why the job is ~1.5 days, not 1.

---

## 3. The plan

Each step says what it changes and how to undo it.

### Step 0 — branch
Work on `feature/transcripts-to-storage`, not `main`.
*Rollback: switch back to `main`.*

### Step 1 — export all 741 transcripts to local disk
Read-only. Nothing in the database changes. Save to a folder outside the repo (they are large and
must not be committed). Record each sermon id, character count and a checksum.

**This file set is the only real backup — see §4 on why.**
*Rollback: nothing to undo.*

### Step 2 — add and backfill `transcript_chars`
A new column plus a one-off backfill. Nothing is removed, nothing else changes yet.
*Rollback: drop the column.*

### Step 3 — switch all 23 presence checks to the new column
Pure code change. Behaviour is identical because the column mirrors reality.
Run the pipeline's read-only reports and confirm the same sermon counts as before.
*Rollback: revert the branch.*

### Step 4 — upload transcripts to file storage
Purely additive: creates files, touches no existing data. Use a **private** bucket, following the
pattern already in `faithhub/app/api/feedback/route.js` (line ~117).
*Rollback: delete the uploaded files.*

### Step 5 — verify all 741, character for character
Compare each stored file against the database copy. **All 741 must match exactly.** Any mismatch
stops the migration.
*Rollback: nothing to undo.*

### Step 6 — change the readers, with a fallback
Add one helper, e.g. `getTranscript(sermonId)` in `.claude/faithhub-pipeline/lib/supabase.js`:
tries storage first, falls back to the database column if the file is missing. Then point the 13
read sites (§5) at the helper.

Because of the fallback the pipeline works **whether or not** the migration has finished. This is
the key safety property.
*Rollback: revert the branch.*

### Step 7 — process one real sermon end to end
Notes, scriptures, word studies, all from the stored transcript. Proof before any deletion.
*Rollback: still nothing deleted.*

### Step 8 — clear the column, in two passes
Ten sermons first. Check the site and the admin console. Then the remaining 731.
**This is the only irreversible step.** By now the transcripts exist in two other places: local
disk and file storage.

### Step 9 — compact the `sermons` table to reclaim the space
Emptying the column marks the space free but does not return it. A compaction pass does. The
table is only 80 MB, so this takes about a minute, unlike the same operation on `sermon_segments`.
Confirm with `select pg_size_pretty(pg_database_size(current_database()));`

---

## 4. Facts the next session needs

**There are no database backups.** Daily backups and point-in-time restore are Pro features; this
project is on the free plan. Supabase has nothing to restore from. The step 1 export is the only
safety net — do not skip it, and do not delete it afterwards.

**Keys and patterns**
- `SUPABASE_SERVICE_KEY` exists in `faithhub/.env.local` — needed for storage upload and writes.
- A working storage example is already in the repo: `faithhub/app/api/feedback/route.js` (~line 117,
  `supabaseAdmin.storage`), writing to a private bucket.

**CLAUDE.md rules that apply**
- Rule 1 — never send a full transcript to an LLM; only `sermon_segments`. This migration does not
  change that, and must not become an excuse to start reading whole transcripts at request time.
- Nothing here touches retrieval, embeddings or the model split.

**Working-environment traps (cost time in the 2026-10-02 session)**
- **Line endings.** Several files are CRLF. Editing them with `sed` in Git Bash silently rewrites the
  whole file to LF, which makes git show thousands of fake changed lines. Use the Edit/Write tools,
  and check with:
  `git show HEAD:<file> | tr -cd '\r' | wc -c` versus `tr -cd '\r' < <file> | wc -c`.
- **A second Claude session edits this repo** (Windows user `Trade`). Re-read files immediately
  before editing. Several pipeline and component files had its uncommitted work.
- **Two dev servers share `faithhub/.next`.** Running `next build` while a dev server is up breaks
  the preview with 404s. Build into a separate folder: `NEXT_DIST_DIR=.next-verify npx next build`.
- **Two Vercel projects deploy from this repo**: `faithhub` (the live site) and `project-lxmyk`,
  which has been failing since before 2026-10-02 and is probably an old leftover.

---

## 5. File inventory

### Reads transcript data from the database (13 sites, need the helper from step 6)

| File | Line | Reads |
|---|---|---|
| `admin-worker/worker-once.js` | 236 | `transcript` |
| `audit-word-study-moments.js` | 164 | `transcript_segments` |
| `claude-extraction/fetch-sermon.js` | 17 | both |
| `extract-scripture-timestamps-run.js` | 67 | `transcript_segments` |
| `extract-scriptures-run.js` | 25 | `transcript` |
| `extract-word-studies-run.js` | 63 | both |
| `generate-notes-run.js` | 51 | `transcript` |
| `lib/supabase.js` | 37 | `transcript_segments` (schema probe) |
| `renew-notes.js` | 112 | `transcript` |
| `run-pipeline.js` | 424, 479, 614, 675 | both |

### Presence checks (23 filters, 9 files — step 3)
See the table in §2.

### App-side presence checks (step 3)
- `faithhub/lib/admin-message.js:48` — `transcript: !!p.transcript` (selects the whole transcript
  just to produce a yes/no)
- `faithhub/lib/admin-dashboard.js:148,163` — readiness counts
- `faithhub/app/admin/(console)/messages/page.js:27` — `transcript: m.transcript` pulls **every
  transcript into the admin message list**; switching to the marker column is a real speed win too

### Display only — no change needed
`components/admin/MessageDetail.js`, `MessagesBoard.js`, `ProcessingBoard.js`, `ReadinessCard.js`,
`CarefulPass.js` consume the booleans the files above produce.

### Decision still open
`transcript_segments` (the timestamped version) is used by embeddings, scripture timestamps and
word studies. It can move the same way, but **do `transcript` first** and keep the two migrations
separate.

---

## 6. State as of this handoff

- Branch `main`, commit `4b8f716`, pushed and **deployed successfully** to the `faithhub` Vercel project.
- `declarations_for_day.sql` has been **run** in Supabase; verified returning different sets per day.
- Nothing from this migration has started. No database changes made.

### Unrelated items left open from the 2026-10-02 session
1. **Today's declaration** (page top and Home) is still an unrelated pick from the first 100 rows.
   Open question: should it come from the day's theme?
2. **Theme rotation** can repeat a theme a few days apart across the seam between 10-day runs
   (never two days running). Enforce a minimum gap?
3. **`/declarations/[theme]`** still shows a total count at the top; counts were removed everywhere else.
4. **Server input limits** are still 2,000 characters while the UI caps are 300/500. Safe, but they
   could be tightened to match.
5. **`project-lxmyk`** on Vercel keeps failing; disconnect it from the repo if it is a leftover.

---

## 7. How to start

Say "start step 1". It is read-only, cannot break anything, and once it finishes there is a real
backup of all 741 transcripts on disk for the first time — worth having whether or not the rest
of the migration goes ahead.
