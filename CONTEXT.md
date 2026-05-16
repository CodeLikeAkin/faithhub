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
│   ├── gemini.js                  ← ⚠️ MISNAMED — contains Groq client, not Gemini
│   ├── supabase.js                ← Supabase client (anon key)
│   └── utils.js                   ← cn() helper (clsx + tailwind-merge)
│
├── supabase/
│   └── functions/
│       └── embed/
│           └── index.ts           ← Edge Function: generates embeddings (gte-small, free)
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
  → match_declarations() RPC — cosine similarity search on declarations.embedding
  → top 10 declarations returned
  → getDeclarations() — Groq generates pastoral response
  → frontend shows AI text + declaration cards with YouTube links
```

### Study Series Chat
```
User picks series + asks question
  → embedText(message) via Supabase Edge Function
  → match_segments() RPC — finds top 15 relevant transcript segments by meaning
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

1. **Never send full `transcript` to Gemini** — use `match_segments()` RPC instead. Full transcripts cause token limit crashes.
2. **Always embed user message first** before querying Supabase for declarations or segments.
3. **Declaration retrieval must use `match_declarations()` RPC** — never `ilike` or `contains`.
4. **`lib/gemini.js` contains Groq, not Gemini** — do not rename without updating all imports.
5. **Gemini is for Study Series only** — Declarations always use Groq.
6. **Bible verse fetches go to `bible.helloao.org`** — never ESV API or any key-gated service.
7. **Embedding column is `vector(384)`** — never switch models without re-embedding all data.
8. **`sermon_segments` table must be populated** by running `backfill-embeddings.js` in the pipeline before Study Series semantic search works.

---

## Refactor History

| Problem | Old Approach | Fixed Approach |
|---|---|---|
| Wrong declarations returned | Keyword `ilike` + broken OR logic | `match_declarations()` pgvector cosine similarity |
| Token crashes in Study Series | Full transcript sent to Gemini | `match_segments()` — only 15 relevant segments |
| No embedding infrastructure | `embeddings.js` existed but never called | Supabase Edge Function (`embed`) — free, built-in |
| Bible verse lookup | ESV API (token-limited) | AO Lab Free Bible API (no key, no limit) |

---

## Related Projects

```
Faithhub/
  faithhub/          ← THIS REPO (Next.js app)
  faithhub-pipeline/ ← Data ingestion pipeline (YouTube → transcribe → extract → Supabase)
```

See `faithhub-pipeline/CONTEXT.md` for pipeline documentation.
