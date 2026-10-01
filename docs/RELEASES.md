# FaithHub releases

Each release is three things that belong together: the **app** (this repo), the **pipeline**
(a separate repo), and a **database export**. Git only versions the first two, so every entry
below records which pipeline tag and which data snapshot go with it.

---

## v1.1.0 — 2026-10-01

Launch release. A visual-consistency pass across the app, the brand splash parked, and two
silent pipeline failures found and fixed.

**App**
- One elevation scale. Seventeen hand-written card shadows had drifted apart at their call
  sites; they now come from three named steps (`subtle` / `card` / `lift`) in the Tailwind
  config. Loading skeletons and phone gutters were swept the same way.
- **Phones no longer have a bottom tab bar.** The whole rail — sections, Your Studies, Vision,
  About — lives in the drawer behind the header's hamburger. A short screen wants the pixels
  more than it wants a second permanent copy of the rail.
- The declaration row actions became icon-only circles, matching the rows beneath them.
- **The brand splash is parked**, not deleted. The navy-background version didn't read right,
  so the site now loads straight to Home. `components/splash/` and the globals.css animation
  are untouched, and `app/layout.js` carries the note on re-wiring it.
- `/series/hero-lab` is gone from the public build. It described itself as scratch UI but was
  routable by anyone who guessed the URL.

**Pipeline — two silent failures, same root cause**

Both generators pointed at floating `-latest` Gemini aliases, which misbehave at real transcript
size while passing small test prompts.

- `generate-notes.js` was on `gemini-flash-latest`, which 503s on most real calls. The OpenRouter
  fallback behind it is out of credits, so notes runs had simply been reporting "0 saved". Pinned
  to `gemini-2.5-flash` — which a live ListModels check shows is *not* retired, contrary to the
  comment that had been sitting in the code.
- `extract.js` was on `gemini-flash-lite-latest`, which returned a **valid but empty** array for
  sermons that plainly contain declarations. No error, so the pipeline logged "No declarations
  found", set `declarations_extracted = true`, and moved on. Pinned to `gemini-3.5-flash-lite`.

⚠️ **This has already cost real coverage: 189 of 297 catalog sermons have zero declaration rows,
and 125 of them carry `declarations_extracted = true`.** That flag means "we ran it", never "it
worked", which is why `admin_coverage` reports the gap as 1 rather than 189. A backfill must clear
the flag first. This is the top post-launch item.

- New: `export-db.js`, a reusable, verified database export. v1.0.0 was exported ad hoc.

| Piece | Where | Version |
|---|---|---|
| App | this repo (`faithhub/`) | tag `v1.1.0` (last code change: `452b610`) |
| Pipeline | `.claude/faithhub-pipeline/` (its own local git repo) | tag `v1.1.0` → commit `83cf58e` |
| Database export | `C:\Users\Trade\Desktop\Faithhub-backups\v1.1.0-2026-10-01\` | exported 2026-10-01 11:18 UTC |

### Database export contents (NDJSON, one row per line)

| Table | Rows |
|---|---|
| sermons | 741 |
| sermon_segments (with embeddings) | 39,511 |
| declarations | 6,880 |
| sermon_scriptures | 19,541 |
| bible_nlt | 31,064 |
| sermon_word_studies | 916 |
| series | 56 |
| series_sermons | 298 |

508 MB, all eight tables verified against their row counts (`manifest.json`). The folder's own
`README.md` has the details and caveats.

### Catalog state at release
297 sermons in the catalog across 56 series. Zero dead videos, zero catalog sermons missing
scriptures, zero missing study notes, zero unpublished. 88 catalog sermons have no word studies
and 189 have no declarations — both are content backfills, not defects in the app.

### How to go back to this version
- App: `git checkout v1.1.0` in `faithhub/`.
- Pipeline: `git checkout v1.1.0` in `.claude/faithhub-pipeline/`.
- Data: re-load the NDJSON files with the service key. **There is still no restore script and a
  restore has still never been rehearsed** — this remains the biggest unaddressed risk.

---

## v1.0.0 — 2026-09-23

First tagged release. Contains the tool-shell redesign (shell/rail, Ask as a study document,
lesson pages, themed declarations + Speak mode, The Word by book/chapter).

| Piece | Where | Version |
|---|---|---|
| App | this repo (`faithhub/`) | tag `v1.0.0` → commit `b4766c3` |
| Pipeline | `.claude/faithhub-pipeline/` (its own local git repo) | tag `v1.0.0` → commit `988c9e4` |
| Database export | `C:\Users\Trade\Desktop\Faithhub-backups\v1.0.0-2026-09-23\` | exported 2026-09-23 18:52 UTC |

### Database export contents (NDJSON, one row per line)

| Table | Rows |
|---|---|
| sermons | 862 |
| sermon_segments (with embeddings) | 41,305 |
| declarations | 6,257 |
| sermon_scriptures | 19,682 |
| sermon_word_studies | 941 |
| bible_nlt | 31,064 |
| series | 56 |
| series_sermons | 295 |

Also in that folder: `manifest.json` (expected vs written row counts — all matched) and
`schema-openapi.json` (a PostgREST description of the tables/columns). Table definitions live
in `supabase/migrations/`; some early tables were created in the Supabase dashboard, so
`schema-openapi.json` is the reference for those.

### How to go back to this version
- App: `git checkout v1.0.0` in `faithhub/`.
- Pipeline: `git checkout v1.0.0` in `.claude/faithhub-pipeline/`.
- Data: re-load the NDJSON files with the service key. **There is no restore script yet and a
  restore has not been tested** — write and rehearse one before relying on it.

### Caveats
- The export ran table by table over ~9 minutes, not as one atomic snapshot. If anything wrote
  to the database during that window, tables can be very slightly out of step with each other.
- Not captured: `.env` secrets (re-create from `.env.example`), Supabase auth/project settings,
  and edge-function deployments (the `embed` function source is in `supabase/functions/`).
- The bundled `yt-dlp.exe` is intentionally not versioned; the current pipeline does not use it.
- Sermon `transcript` text and the NLT Bible (Tyndale-copyrighted) are in the export — keep the
  backup folder private and out of any public repo.
