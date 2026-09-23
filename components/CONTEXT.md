# components/ — Context

## What This Folder Does

Shared React components used across multiple pages.

---

## Tool pages (Ask, lessons, series) — three layers

The grounded Q&A surface is ONE feature with a scope (Everything / This series /
This message), rendered the same way on `/ask` and beside a lesson. Study state and
the answer stream live in `lib/studies.js`, not in these components.

### `shell/` — the frame every tool page shares
- `ToolShell.js` — rail | header / main | optional panel. Owns the mobile drawers
  (rail from the left, panel as a bottom sheet), `inert` on the columns behind them,
  body-scroll lock, Escape. Also exports `HeaderButton`.
- `ToolRail.js` — logo, links between tools, the user's saved studies (the open study
  unfolds into its question outline). Collapses to a 72px icon strip.

### `ask/` — the grounded answer, laid out as a research brief
- `Composer.js` — the one composer. `variant="hero"` (empty states) or `"docked"`
  (rides above the keyboard via `useKeyboardInset`, safe-area padding).
- `ScopeChip.js` — the scope switch inside the composer.
- `StudyDocument.js` — a study as one document; every question stays expanded. Keeps
  the old Ask scroll fixes: absolute scroll-to-top for a new question, the
  `min-h-[70vh]` headroom spacer while streaming, `overflowAnchor: none`.
- `AnswerBlock.js` — one question: heading → `MomentsRow` → `AnswerBody` +
  `ScriptureMargin` → `FollowUps`; plus searching / error / "nothing found" states.
- `AnswerBody.js` — markdown answer with `[N]` citation pills and scripture links.
- `MomentsRow.js` — cited moments as swipeable video thumbnails (every screen size).
- `ScriptureMargin.js` — the scriptures an answer names, with verse text (KJV/NLT).
- `FollowUps.js`, `AskEmptyState.js`.

### `lesson/` — series overview + per-message lesson
- `useSeriesBundle.js` — all the Supabase loading for a series or sermon. A message filed
  under two series resolves to the one with the lowest part number (asking for a single row
  makes PostgREST reject the query).
- `SeriesOverview.js` (`/series/[id]`) and `LessonPage.js` (`/sermon/[id]`).
- `LessonPlayer.js` — embedded YouTube player; `seek={videoId,t,n}` jumps it via the
  IFrame API (postMessage) instead of reloading. Shows a message if YouTube refuses
  to play a video (private/restricted).
- `CourseOutline.js`, `AskPanel.js` (the Ask side panel — resumes this series' latest
  study; "Open full page" continues it on `/ask`), `Section.js`.

### `declarations/` — the declarations library
- `DeclarationLine.js` — one declaration: watch the moment, copy, save to My declarations.
  The only declaration row — the lesson and series pages use it too (`sourceLabel` names the
  part). Never fork it.
- `SpeakMode.js` — full-screen, one at a time, auto-play with speed; opening it counts
  toward the speaking streak. Render it through ToolShell's `overlay` slot.
- `ThemeChips.js` (My declarations + the 10 themes), `SpeakAllBar.js` (sticky "Speak all").

### `word/` — The Word
- `BibleNav.js` — the Bible by canon section with a bar per book (used in `app/word/layout.js`).
- `WordLanding.js` (gets server-computed stats from `app/word/page.js`), `BookView.js`
  (chapter bar chart, passages, messages), `ChapterView.js` (verses + messages + watch).

### `home/` — the home page's live sections
- `ThisWeek.js` (latest message, today's declaration, current series), `ContinueRow.js` (last
  lesson + recent studies), `FeatureCards.js`. The quick-ask search lives in `Navbar.js` now
  (→ `/ask?q=`), not a home-page component.

---

## Other shared components

- `Navbar.js` — global pill nav (`app/layout.js`), shown on Home and Vision only. Every tool
  route (`/ask`, `/declarations`, `/series`, `/sermon`, `/word`, `/admin` and their sub-pages)
  brings its own chrome via ToolShell.
- `Button.js` — pill link/button (variants light / dark / outline / quiet; sizes lg / sm).
- `VideoModal.js` — full-screen / draggable mini player for a cited moment.
- `VerseCard.js` — a scripture with its text + `TranslationToggle` (shared by answers
  and the series overview).
- `VerseExplorer.js`, `WordStudy.js` — per-sermon scriptures and Greek/Hebrew words
  (`embedded` for use under a page's own heading; WordStudy takes `onWatch`).
- `Decor.js` — the Vision page's `Rings` / `DotGrid` decoration.
- `shell/Toast.js` — `useToast({ offset })` (with an optional Undo action), `copyText()` and
  `deleteStudyWithUndo()`.

---

## Conventions

- All components are JavaScript (`.js`), not TypeScript
- Styling uses Tailwind CSS utility classes and the `brand-*` tokens; named type steps only
- shadcn/ui components (from `@/components/ui/`) are auto-generated via CLI and live in `components/ui/` — do not manually edit those files
- Use `cn()` from `@/lib/utils` for conditional class merging
