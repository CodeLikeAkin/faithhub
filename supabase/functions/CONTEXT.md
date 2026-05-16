# supabase/functions/ — Context

## What This Folder Does

Supabase Edge Functions — Deno-based TypeScript functions deployed to and run inside Supabase's infrastructure. These are NOT part of Next.js. They are deployed separately using the Supabase CLI.

Deploy command:
```bash
npx supabase functions deploy embed
```

---

## Functions

### `embed/index.ts` — Text Embedding Generator

**The most critical infrastructure piece in the project.**

#### What It Does
Converts any text string into a 384-dimensional vector using the `gte-small` open-source model. Runs natively inside Supabase — no OpenAI, no external API, no cost.

#### Why It Exists
All semantic search depends on vector comparison. Before querying Supabase for similar declarations or transcript segments, the user's message must be converted to a vector. This function does that.

#### Endpoint
```
POST {SUPABASE_URL}/functions/v1/embed
Authorization: Bearer {SUPABASE_ANON_KEY or SERVICE_KEY}
Content-Type: application/json

Body: { "text": "I am struggling with fear about my finances" }
Response: { "embedding": [0.023, -0.14, ...] }  // 384 floats
```

#### Called By
- `app/api/declarations/route.js` — embeds user's situation before declaration search
- `app/api/series-chat/route.js` — embeds user's question before segment search

#### Critical Rules
- **Always use this function** — never call OpenAI embeddings API
- Model: `Supabase/gte-small` — produces exactly **384 dimensions**
- Every `vector` column in Supabase is `vector(384)` to match
- **Never switch models** without re-running the full backfill script — mismatched models produce meaningless similarity scores

---

## Supabase SQL Functions (Live in Dashboard, not files)

These Postgres RPC functions are created via the Supabase SQL Editor. Documented here for reference.

### `match_declarations(query_embedding, match_threshold, match_count, exclude_ids)`
- Cosine similarity search on `declarations.embedding`
- Returns declarations sorted by relevance to the query vector
- `exclude_ids` prevents showing already-seen declarations
- Called by: `app/api/declarations/route.js`

### `match_segments(query_embedding, filter_series_id, match_threshold, match_count)`
- Cosine similarity search on `sermon_segments.embedding`
- Scoped to a specific series via `filter_series_id`
- Returns the 15 most relevant transcript segments for the user's question
- Called by: `app/api/series-chat/route.js`

---

## Deployment Steps (First Time)

```bash
# From faithhub/ root
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy embed
```

After deploying, test it:
```bash
curl -X POST {SUPABASE_URL}/functions/v1/embed \
  -H "Authorization: Bearer {ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"text": "I am the righteousness of God in Christ Jesus"}'
```

You should get back a JSON object with a 384-element `embedding` array.
