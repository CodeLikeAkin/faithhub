# lib/ — Context

## What This Folder Does

Shared client instances and AI utility functions used across API routes.

---

## Files

### `gemini.js` ⚠️ MISNAMED — Uses Groq, Not Gemini

Despite the filename, this contains the **Groq** client and two exported functions:

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

**Do not add Gemini logic here.** Gemini lives in `app/api/series-chat/route.js`.

---

### `supabase.js`
Exports a single `supabase` client using the **anon key**.

```js
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

For server-side routes needing elevated access (bypassing RLS), API routes create their own client using `SUPABASE_SERVICE_KEY` directly — they do not import from here.

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

- Gemini client → `app/api/series-chat/route.js`
- Embedding logic → `supabase/functions/embed/index.ts`
- Bible API fetch → `app/api/declarations/route.js`
- Supabase service-role client → instantiated inline in each API route that needs it
