# FaithHub releases

Each release is three things that belong together: the **app** (this repo), the **pipeline**
(a separate repo), and a **database export**. Git only versions the first two, so every entry
below records which pipeline tag and which data snapshot go with it.

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
