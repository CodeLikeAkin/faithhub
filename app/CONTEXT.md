# app/ — Context

## What This Folder Does

All Next.js pages and API routes. Uses the App Router pattern — every folder with a `page.js` is a route, every folder with a `route.js` is an API endpoint.

---

## Pages

### `page.js` — Landing Page
The main entry point. Links users to the two core features: Faith Declarations and Study Series.

### `declarations/page.js` — Faith Declarations UI
- User types their situation (e.g. "I'm struggling with fear about my job")
- Sends POST to `/api/declarations`
- Displays AI pastoral response + declaration cards
- Each card shows: declaration text, sermon title, YouTube timestamp link
- "Show more" button sends `shownIds` to paginate without repeats

### `series/page.js` — Series Listing
- Fetches all series from Supabase
- Displays series cards with title, summary, sermon count
- Each card links to `/series/[id]`

### `series/[id]/page.js` — Individual Series Study (Chat UI)
- Fetches series metadata on load → calls `/api/series-summary` for intro
- Chat interface: user asks questions about the series
- Sends POST to `/api/series-chat` with `seriesId`, `message`, `chatHistory`
- Streams Gemini response with citation brackets `[N]`
- Renders citations as clickable YouTube links with timestamps
- Shows follow-up suggestion buttons after each response

### `admin/page.js` — Admin Dashboard
- Protected page for managing content
- Details: ask the developer

---

## API Routes

### `api/declarations/route.js`
**POST `/api/declarations`**

Input:
```json
{ "message": "string", "shownIds": ["uuid", ...] }
```

Flow:
1. Embed `message` via Supabase Edge Function
2. Call `match_declarations()` RPC (pgvector cosine search)
3. Fallback to random if 0 results
4. Call Groq (`getDeclarations`) for pastoral response
5. Return `{ response, declarations[], hasMore }`

**Rules:**
- Never use `ilike` or `contains` for retrieval
- Always embed first, always use RPC
- `shownIds` prevents repeat declarations across sessions

---

### `api/series-chat/route.js`
**POST `/api/series-chat`**

Input:
```json
{ "seriesId": "uuid", "message": "string", "chatHistory": [...] }
```

Flow:
1. Fetch series + sermon metadata (titles, video IDs only — NOT full transcripts)
2. Embed `message` via Supabase Edge Function
3. Call `match_segments()` RPC → top 15 relevant transcript segments
4. Build lean context from those 15 segments only
5. Stream Gemini 2.5 Flash response with `[N]` citations
6. Return streamed `text/plain` response

**Rules:**
- NEVER fetch or send `transcript` (full text) to Gemini
- Only `sermon_segments` table data goes to Gemini
- Cap chat history at last 6 messages before sending
- If `sermon_segments` table is empty (not yet backfilled), falls back to raw `transcript_segments` from sermons table

---

### `api/series-summary/route.js`
**POST `/api/series-summary`**

Input:
```json
{ "title": "string", "sermonTitles": ["string", ...] }
```

Flow:
1. Groq (`llama-3.1-8b-instant`) generates 3-5 sentence summary
2. Second Groq call generates 3 follow-up questions as JSON array
3. Return `{ summary, suggestions[] }`

**Notes:**
- No embeddings, no Supabase fetch — lightweight
- Runs once when user opens a series page
- Uses smaller/faster model since quality bar is lower here
