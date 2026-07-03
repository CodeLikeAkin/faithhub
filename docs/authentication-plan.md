# Authentication & Saved Content — Plan (for church review)

Status: **proposed / deferred.** Not implemented yet. This document captures the
agreed direction so the church can review and approve before it is built.

## Guiding principle

FaithHub is **open by default.** Anyone can visit the site and use it fully with
no sign-in. Authentication is introduced at exactly one point: when a user wants
to **keep** something (save a declaration, bookmark a sermon/verse, build a
collection). Saving is the only thing behind a login.

## What stays open — no account, ever

- Faith Declarations (search + Declaration of the Day)
- Study Series and individual sermon pages
- Verse Explorer (see every scripture used in a message)
- Reverse scripture index and scripture heat-map
- Global "ask everything" chat

## What requires sign-in

- Save a declaration
- Bookmark a sermon, series, or verse
- Collections (e.g. "My Healing Wall", "Believing for a child")
- (later, optional) personal streaks / history

## Proposed method

- **Email only.** A magic link or 6-digit code — no passwords, no social logins.
  Lowest possible friction for a congregation.
- Built on **Supabase Auth**, which we already use for the database — no new
  vendor, no new cost.
- A single `saved_items` table keyed by `user_id` (item type + item id).

## Why deferred

- The core value (study + declarations) needs no account. Shipping open first
  maximises reach and lets anyone share a link that just works.
- Save/collections are **additive** — they can be switched on later without
  reworking anything already built.

## Open questions for the church

1. Do we want accounts at all, or would **device-local bookmarks** (saved in the
   browser, no login) be enough for now?
2. Email magic-link vs. **phone / WhatsApp OTP** — which suits the congregation
   better in Nigeria?
3. Any future desire for **member-only content**? That would change this from a
   "save gate" into a "content gate" and needs a separate decision.

---

_Scope note: FaithHub deliberately stays focused on **study and declarations.**
Church-life features (service times, giving, testimonies, live stream) are owned
by the main church website (hofng.org) and are intentionally out of scope here._
