# lib/ — Context

## What This Folder Does

Shared client instances and AI utility functions used across API routes.

---

## Files

### `groq.js`

Contains the **Groq** client and four exported functions:

#### `planDeclarationSearch(userMessage)`
- Called by: `app/api/declarations/route.js`, before embedding
- Groq `openai/gpt-oss-20b`, JSON mode, temperature 0, 6s timeout, no retries; returns `null` on failure
- Returns `{ declarations: string[3], keywords: string[0-3] }`. One rewrite is single-minded —
  it leans either concrete ("my ears are healed") or role/outcome ("I walk in wisdom") and only
  ever recovers whichever slice of the library that phrasing sits near. Three differently-worded
  lines (plain need, church/Bible phrasing, specific outcome) each land in a different
  neighbourhood of gte-small's vector space; the route fuses all three legs (plus keyword legs)
  instead of betting on one phrasing

#### `rerankDeclarations(userMessage, candidateTexts)`
- Called by: `app/api/declarations/route.js`, after the fused multi-leg search
- Groq `openai/gpt-oss-20b`, JSON mode, temperature 0, 7s timeout, no retries; returns `null` on
  failure or an empty pick list (caller keeps the fused order)
- Takes up to 60 candidate `declaration_text` strings, returns up to 15 picks (1-based indices,
  best fit first). The fused order is positional (rank, not relevance — see
  `match_declarations_hybrid` in `hybrid_search.sql`), so a candidate that only shares a word
  with the need (e.g. "Father" for someone whose father died) can still rank near the top of a
  leg; this reads the actual sentences and re-picks. Explicitly told the need is what someone is
  *facing*, not their stated role ("I'm a pastor and I'm tired" → tiredness, not ministry)

#### `getDeclarations(userMessage)`
- Called by: `app/api/declarations/route.js`
- Takes only the user's situation (the cards are deliberately kept out of the prompt)
- Calls Groq `openai/gpt-oss-120b`
- Returns pastoral encouragement response in Rev. Peter's voice
- System prompt instructs it to speak in first person as Rev. Peter Alabi
- Does NOT list declarations in the text — they appear as cards in the UI

#### `classifyUserIntent(userMessage)`
- Called by: `app/api/declarations/route.js` (legacy — may be deprecated)
- Classifies message into topic + keywords
- Returns `{ topic: string | null, keywords: string[] }`
- Originally used for keyword-based Supabase filtering
- Now supplementary — primary retrieval uses embeddings via `match_declarations()` RPC

**Do not add Gemini logic here.** Gemini is called inline in `app/api/series-chat/route.js` and `app/api/ask/route.js` (model: `gemini-flash-latest` — `gemini-2.5-flash` was retired in mid-2026).

---

### `supabase.js`
Exports a single `supabase` client using the **anon key**.

```js
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

For server-side routes needing elevated access (bypassing RLS), API routes create their own client using `SUPABASE_SERVICE_KEY` directly — they do not import from here.

---

### `bible.js`
Verse text + book maps. `fetchPassage({ book, bookId, chapter, verseStart, verseEnd }, translation)`
— `translation` defaults to `"KJV"`. KJV fetches live from the AO Lab API
(`bible.helloao.org`, translation id `eng_kjv`); `"NLT"` reads from the local `bible_nlt`
Supabase table instead (NLT is Tyndale-copyrighted, not on the free API — loaded once via
`.claude/faithhub-pipeline/backfill-bible-nlt.js`). Also exports `TRANSLATIONS` (`["KJV","NLT"]`),
`BOOK_ORDER`, `BOOK_ABBR`, `OT_COUNT`, `bookIdFor()`. Used by `VerseExplorer.js`,
`VerseCard.js` (answer margins + series key verses, session-cached), `WordStudy.js`, and
`word/page.js` (book lookups only, no verse text).

---

### `studies.js`
The saved-studies store behind every grounded-answer surface (`/ask`, the lesson/series Ask
panel, the rail). `useStudies()` → `{ studies, busy, ready }`; `askQuestion({ studyId, question,
scope, context })` streams the answer **in the store** (it survives navigation) and maps the
scope to the unchanged backend call (Everything → `/api/ask`, series/message →
`/api/series-chat`). Persists to localStorage `hof-ask-studies-v2` (never mid-stream; caps
12 studies × 30 blocks — segment maps are ~7 KB a block). A transient 503 ("high demand") is
retried once, 1.5s later, before anything has streamed. Also `retryBlock`, `deleteStudy` /
`restoreStudy` (Undo), `scopesFor(context)`, `latestStudyFor()`.

### `declarations.js`
The declarations library: `THEMES` (the 10 biggest `topic_tags`), `fetchThemePage` /
`fetchThemeCount` (a tag FILTER — CLAUDE.md rule 2 — newest teaching first, no LLM),
`fetchTodaysDeclaration` (deterministic day-of-year pick), My declarations
(`useSavedDeclarations`, `toggleSaved`, `restoreSaved`; localStorage `hof-decl-saved-v1`) and the
speaking streak (`useStreak`, `recordSpeakDay`; same `hof-decl-streak` key as the old visit streak).

### `canon.js`, `word-data.js`, `recent.js`
The Bible's shape for The Word (canon sections, chapter counts, `/word/<slug>` ↔ book), The
Word's session-cached data loaders (`loadBookStats`, `loadBookRows` — paged, ordered chapter+id —
`loadChapterText`, `useLoad`), and the last lesson/series opened (home's "Continue").

### `ask-format.js`, `ask-examples.js`, `scroll.js`, `useMediaQuery.js`
Answer formatting (`fmtTime`, `titleFrom`, `SCRIPTURE_RE`, `extractScriptures`,
`parseScriptureRef`), the Ask empty state's example questions, scrolling inside nested
overflow containers (`scrollToElement`, `afterLayout`), and a `matchMedia` hook.

---

### `utils.js`
Exports `cn()` — a Tailwind class merging utility.

```js
cn("px-4 py-2", isActive && "bg-blue-500")
// → merges clsx + tailwind-merge
```

Used throughout components for conditional class names.

---

## What Does NOT Live Here

- Gemini client → `app/api/series-chat/route.js` and `app/api/ask/route.js`
- Embedding logic → `supabase/functions/embed/index.ts`
- Supabase service-role client → instantiated inline in each API route that needs it
