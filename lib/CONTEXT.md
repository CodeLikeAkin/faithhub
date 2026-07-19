# lib/ — Context

## What This Folder Does

Shared client instances and AI utility functions used across API routes.

---

## Files

### `groq.js`

Contains the **Groq** client and two exported functions:

#### `getDeclarations(userMessage, declarations)`
- Called by: `app/api/declarations/route.js`
- Takes user's situation + array of declarations from Supabase
- Calls Groq `llama-3.3-70b-versatile`
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
`StudyWorkspace.js` (key verses), and `word/page.js` (book lookups only, no verse text).

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
