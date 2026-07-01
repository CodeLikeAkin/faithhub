# FaithHub — Root Context

## What This Project Is

FaithHub is a Next.js 14 web application for Heritage of Faith Church (Lead Pastor: Rev. Peter Ayo Alabi, Lagos, Nigeria). It turns years of sermon content (YouTube, 2022–2026) into two interactive AI-powered features:

1. **Faith Declarations** — User describes their situation, app returns curated faith declarations Rev. Peter has actually spoken, displayed as cards with YouTube timestamp links.
2. **Study Series** — User picks a sermon series from the church's YouTube page, asks questions about it, and gets AI answers grounded strictly in Rev. Peter's transcripts — like NotebookLM but locked to one source.

---

## Folder Structure

```
faithhub/                          ← YOU ARE HERE (Next.js app root)
│
├── app/                           ← All pages and API routes (Next.js App Router)
│   ├── layout.js                  ← Root layout (fonts, global wrappers)
│   ├── page.js                    ← Landing page
│   ├── globals.css                ← Global styles
│   │
│   ├── declarations/
│   │   └── page.js                ← Faith Declarations UI page
│   │
│   ├── series/
│   │   ├── page.js                ← Series listing page (all series)
│   │   └── [id]/
│   │       └── page.js            ← Individual series study page (chat UI)
│   │
│   ├── admin/
│   │   └── page.js                ← Admin dashboard (content management)
│   │
│   └── api/
│       ├── declarations/
│       │   └── route.js           ← POST: returns faith declarations for user's situation
│       ├── series-chat/
│       │   └── route.js           ← POST: Study Series chat endpoint (Gemini streaming)
│       └── series-summary/
│           └── route.js           ← POST: generates series intro summary (Groq)
│
├── components/
│   └── Navbar.js                  ← Global navigation bar
│
├── lib/
│   ├── groq.js                    ← Groq client (used by Declarations + summary)
│   ├── voice.js                   ← Rev. Peter signature-phrase glossary → chat prompt
│   ├── supabase.js                ← Supabase client (anon key)
│   └── utils.js                   ← cn() helper (clsx + tailwind-merge)
│
├── supabase/
│   ├── functions/
│   │   └── embed/
│   │       └── index.ts           ← Edge Function: generates embeddings (gte-small, free)
│   └── migrations/
│       ├── hybrid_search.sql          ← FTS columns + *_hybrid RPCs (RRF) — APPLY THIS
│       ├── match_segments_by_sermons.sql ← vector-only fallback RPC
│       └── vector_indexes.sql         ← HNSW indexes
│
├── .env.local                     ← Secret keys (never commit)
├── .env.example                   ← Template for required env vars
├── next.config.mjs
├── tailwind.config.js
└── components.json                ← shadcn/ui config
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, JavaScript) |
| Styling | Tailwind CSS + shadcn/ui + Radix UI |
| Database | Supabase (Postgres + pgvector) |
| LLM — Declarations response | Groq (`llama-3.3-70b-versatile`) |
| LLM — Study Series chat | Google Gemini 2.5 Flash (streaming) |
| LLM — Series summary | Groq (`llama-3.1-8b-instant`) |
| Embeddings | Supabase Edge Function (`gte-small`, 384 dims, FREE) |
| Bible verses | AO Lab Free Bible API — `bible.helloao.org` (no key, no limit) |
| Deployment | Vercel |

---

## Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=
```

---

## Supabase Schema (Key Tables)

```
declarations
  id                          uuid  PK
  sermon_id                   uuid  FK → sermons.id
  declaration_text            text
  youtube_url_with_timestamp  text
  topic_tags                  text[]
  embedding                   vector(384)   ← semantic search column

sermons
  id                          uuid  PK
  title                       text
  youtube_url                 text
  youtube_video_id            text
  transcript                  text          ← full raw transcript (NOT sent to AI)
  transcript_segments         jsonb         ← [{text, start_seconds}]

series
  id                          uuid  PK
  title                       text

series_sermons
  series_id                   uuid  FK → series.id
  sermon_id                   uuid  FK → sermons.id
  part_number                 int

sermon_segments               ← NEW table (added in semantic refactor)
  id                          uuid  PK
  sermon_id                   uuid  FK → sermons.id
  series_id                   uuid  FK → series.id
  text                        text
  start_seconds               int
  embedding                   vector(384)
```

---

## How Each Feature Works

### Faith Declarations
```
User types situation
  → embedText(message) via Supabase Edge Function (gte-small)
  → match_declarations_hybrid() RPC — vector + keyword (FTS) fused with RRF
      (degrades to keyword-only if the embed service is down;
       falls back to match_declarations() if the hybrid RPC isn't applied yet)
  → top 10 declarations returned
  → getDeclarations() — Groq generates pastoral response
  → frontend shows AI text + declaration cards with YouTube links
```

### Study Series Chat
```
User picks series + asks question
  → embedText(message) via Supabase Edge Function
  → match_segments_hybrid() RPC — vector + keyword (FTS) fused with RRF,
      scoped to the series' sermon_ids; retrieves a pool of ~40
      (degrades to keyword-only if embed is down;
       falls back to match_segments_by_sermons() if hybrid RPC not applied)
  → rerankSegments() in the route — dedupe + per-sermon diversity cap → top 15
  → ONLY those 15 segments sent to Gemini (NOT full transcript)
  → Gemini streams cited response with [N] citation brackets
  → frontend renders citations as clickable YouTube timestamp links
```

### Series Summary
```
User opens a series
  → Groq generates 3-5 sentence summary from series title + sermon titles
  → Groq generates 3 follow-up questions
  → shown as series intro before chat begins
```

---

## Critical Rules for Any AI Working on This Project

1. **Never send full `transcript` to Gemini** — use the hybrid segment RPC instead. Full transcripts cause token limit crashes.
2. **Always embed user message first** before querying Supabase for declarations or segments.
3. **Retrieval must use the RPCs** — `match_segments_hybrid()` / `match_declarations_hybrid()` (vector + keyword). Never `ilike` or `contains`. The old vector-only RPCs (`match_segments_by_sermons()`, `match_declarations()`) remain only as fallbacks.
4. **Study Series LLM client lives in `lib/groq.js`** and Gemini is called inline in the route — the client util is Groq despite the feature using Gemini for chat. Do not rename without updating all imports.
5. **Gemini is for Study Series only** — Declarations always use Groq.
6. **Bible verse fetches go to `bible.helloao.org`** — never ESV API or any key-gated service.
7. **Embedding column is `vector(384)` (gte-small)** — never switch models without re-embedding all data. Chunking + the gte-small embedder are centralized in `faithhub-pipeline/lib/embed-content.js`; the query-time embedder is the `embed` edge function. They MUST stay the same model.
8. **`sermon_segments` is now populated automatically** by the pipeline (transcribe/extract auto-embed via `embed-content.js`). `backfill-embeddings.js` is only for re-embedding existing data (e.g. after the overlap change). Run `node coverage.js` to see which series are fully embedded.
9. **New search RPCs + FTS columns require `supabase/migrations/hybrid_search.sql`** to be applied. Until it's run, routes silently fall back to vector-only. Also apply `vector_indexes.sql` for HNSW indexes.

---

## Refactor History

| Problem | Old Approach | Fixed Approach |
|---|---|---|
| Wrong declarations returned | Keyword `ilike` + broken OR logic | `match_declarations()` pgvector cosine similarity |
| Token crashes in Study Series | Full transcript sent to Gemini | `match_segments()` — only 15 relevant segments |
| No embedding infrastructure | `embeddings.js` existed but never called | Supabase Edge Function (`embed`) — free, built-in |
| Bible verse lookup | ESV API (token-limited) | AO Lab Free Bible API (no key, no limit) |
| Vector search missed exact phrases/scripture | Pure pgvector cosine (gte-small) | Hybrid vector + keyword FTS, RRF-fused (`*_hybrid` RPCs) |
| Thoughts split at chunk boundaries | Hard 300-word flush, no overlap | ~50-word overlap in `embed-content.js buildChunks` |
| Top-15 raw cosine, noisy context | Fed straight to Gemini | Retrieve ~40 → `rerankSegments()` dedupe + diversity → 15 |
| Segments only via manual backfill (silent rot) | `backfill-embeddings.js` run by hand | Pipeline auto-embeds on transcribe/extract; `coverage.js` visibility |
| Duplicate/mismatched embedder (all-MiniLM) | Dead `lib/embeddings.js` (wrong model) | Deleted; single gte-small source in `lib/embed-content.js` |

---

## Related Projects

```
Faithhub/
  faithhub/          ← THIS REPO (Next.js app)
  faithhub-pipeline/ ← Data ingestion pipeline (YouTube → transcribe → extract → Supabase)
```

See `faithhub-pipeline/CONTEXT.md` for pipeline documentation.
