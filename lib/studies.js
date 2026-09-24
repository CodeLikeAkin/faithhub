"use client";

// Studies — the saved, device-local record of every grounded question a
// believer has asked, whether on /ask or in a lesson's Ask panel. One store
// shared by every surface (the rail, the Ask page, the panel), so a study
// started on a lesson can be reopened full-page and vice versa.
//
// The question → answer stream runs HERE, not inside a component: navigating
// from a lesson to /ask mid-answer keeps the answer streaming instead of
// cutting it off with an unmount.
//
// Storage: localStorage key `hof-ask-studies-v2` (unchanged from the old Ask
// page, so existing studies carry over). The schema only gained optional
// fields — `study.context` and `block.scope` — so no key bump was needed.
// A question is saved the moment it's asked (as "interrupted" until it
// finishes), so a reload mid-search leaves a retryable block, not nothing.

import { useSyncExternalStore } from "react";
import { clientIdHeader } from "./client-id";
import { titleFrom } from "./ask-format";

const STORE_KEY = "hof-ask-studies-v2";
const LEGACY_KEY = "hof-ask-study-v1";
// sessionStorage: the study /ask was last showing, so coming back to it (from
// another tool, or after the tab reloads) resumes it. Per browser session on
// purpose — a fresh visit starts on the search box.
const OPEN_KEY = "hof-ask-open-study";
// Segment maps run ~7 KB a block, so these caps keep a full history well
// inside the ~5 MB localStorage budget. Don't raise them casually.
const MAX_STUDIES = 12;
const MAX_BLOCKS = 30;
// How long to wait before the single retry of a 503 (see streamAnswer).
const RETRY_DELAY_MS = 1500;

export const SCOPE_ALL = { type: "all", label: "Everything" };

// ── Scopes ────────────────────────────────────────────────────────────────────
// A scope says which messages a question searches. Each maps onto the backend
// call it always used — retrieval itself is untouched:
//   all     → POST /api/ask            { message }
//   series  → POST /api/series-chat    { seriesId, message, chatHistory }
//   message → POST /api/series-chat    { seriesId, sermonId, message, chatHistory }

export const scopeKey = (scope) =>
  !scope || scope.type === "all"
    ? "all"
    : scope.type === "series"
    ? `series:${scope.seriesId}`
    : `message:${scope.sermonId}`;

export const sameScope = (a, b) => scopeKey(a) === scopeKey(b);

/**
 * The scopes a context can offer, broadest first.
 * context = { seriesId?, seriesTitle?, sermonId?, sermonTitle?, partNumber? }
 */
export function scopesFor(context) {
  const out = [SCOPE_ALL];
  if (context?.seriesId) {
    out.push({
      type: "series",
      seriesId: context.seriesId,
      label: context.seriesTitle || "This series",
    });
  }
  if (context?.sermonId) {
    out.push({
      type: "message",
      seriesId: context.seriesId || null,
      sermonId: context.sermonId,
      label: context.partNumber
        ? `Part ${context.partNumber} · ${context.sermonTitle || "This message"}`
        : context.sermonTitle || "This message",
    });
  }
  return out;
}

function requestFor(scope, message, chatHistory) {
  if (scope?.type === "series") {
    return { url: "/api/series-chat", body: { seriesId: scope.seriesId, message, chatHistory } };
  }
  if (scope?.type === "message") {
    return {
      url: "/api/series-chat",
      body: { seriesId: scope.seriesId || null, sermonId: scope.sermonId, message, chatHistory },
    };
  }
  return { url: "/api/ask", body: { message } };
}

// ── Store ─────────────────────────────────────────────────────────────────────
const SERVER_SNAPSHOT = Object.freeze({ studies: [], busy: false, ready: false });
let state = SERVER_SNAPSHOT;
let loaded = false;
const listeners = new Set();

const inFlight = (b) => b.status === "searching" || b.status === "answering";
const isStreaming = (studies) => studies.some((s) => s.blocks.some(inFlight));

const INTERRUPTED = "That question was interrupted before it finished. Please try again.";

// A question still in flight is saved as a failed one: if the page reloads
// before it finishes, it comes back as "interrupted — Try again" rather than
// vanishing, and a half-written answer never survives as if it were complete.
const savedBlock = (b) =>
  inFlight(b) ? { ...b, status: "error", answer: INTERRUPTED, segmentMap: {}, suggestions: [], retrying: false } : b;

/**
 * Peel the `SUGGESTIONS:[…]` tail off a streamed answer. Matched loosely —
 * the model occasionally misspells the marker ("SUGESTIONS:"), and a missed
 * marker would print the raw JSON list into the answer. Mid-stream the array
 * is incomplete; suggestions stay empty until it parses.
 */
function splitAnswer(raw) {
  let tail = null;
  for (const m of (raw || "").matchAll(/SUG{1,2}ESTIONS?\s*:/gi)) tail = m;
  if (!tail) return { answer: raw || "", suggestions: [] };
  let suggestions = [];
  try {
    const parsed = JSON.parse(raw.slice(tail.index + tail[0].length).trim());
    if (Array.isArray(parsed)) suggestions = parsed.filter((s) => typeof s === "string");
  } catch {
    /* still streaming the suggestions array */
  }
  return { answer: raw.slice(0, tail.index).trim(), suggestions };
}

// Saved studies can predate scopes/context, or carry a status from a crash.
function normalize(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((s) => s && s.id && Array.isArray(s.blocks))
    .map((s) => ({
      ...s,
      title: s.title || titleFrom(s.blocks[0]?.question || "Study"),
      context: s.context || null,
      updatedAt: s.updatedAt || s.createdAt || s.id,
      blocks: s.blocks
        .filter((b) => b && b.id && b.question)
        .map((b) => {
          // Answers saved before the loose marker match may still carry it.
          const split = splitAnswer(b.answer || "");
          return {
            ...b,
            answer: split.answer,
            scope: b.scope || SCOPE_ALL,
            retrying: false,
            segmentMap: b.segmentMap || {},
            suggestions: Array.isArray(b.suggestions) && b.suggestions.length ? b.suggestions : split.suggestions,
            status: b.status === "error" ? "error" : "done",
          };
        }),
    }))
    .filter((s) => s.blocks.length);
}

function readStorage() {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) return { studies: normalize(JSON.parse(raw)?.studies), migrated: false };

  // v1: a single flat list of blocks, newest first.
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (!legacy) return { studies: [], migrated: false };
  localStorage.removeItem(LEGACY_KEY);
  const old = JSON.parse(legacy);
  if (!Array.isArray(old) || !old.length) return { studies: [], migrated: false };
  const blocksAsc = [...old].reverse().filter((b) => b && b.id && b.question);
  if (!blocksAsc.length) return { studies: [], migrated: false };
  return {
    studies: normalize([
      {
        id: blocksAsc[0].id,
        title: titleFrom(blocksAsc[0].question),
        createdAt: blocksAsc[0].id,
        updatedAt: Date.now(),
        blocks: blocksAsc,
      },
    ]),
    migrated: true,
  };
}

// `force` saves mid-stream. Streamed chunks don't (that would re-serialise
// every study on every word); only askQuestion does, once, so the question
// itself is on disk from the moment it's asked.
function persist(force = false) {
  if (typeof window === "undefined" || !loaded) return;
  if (!force && isStreaming(state.studies)) return;
  try {
    const toSave = [...state.studies]
      .filter((s) => s.blocks.length)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, MAX_STUDIES)
      .map((s) => ({ ...s, blocks: s.blocks.slice(-MAX_BLOCKS).map(savedBlock) }));
    if (!toSave.length) localStorage.removeItem(STORE_KEY);
    else localStorage.setItem(STORE_KEY, JSON.stringify({ studies: toSave }));
  } catch {
    /* storage full or unavailable — studies just won't persist */
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function update(fn) {
  state = { ...state, ...fn(state) };
  emit();
  persist();
}

// Another tab saved — pick its studies up, unless this tab is mid-answer (its
// own save would clobber the other tab's, and vice versa, either way).
function onStorage(e) {
  if (e.key !== STORE_KEY || state.busy) return;
  try {
    state = { ...state, studies: normalize(JSON.parse(e.newValue || "{}")?.studies) };
    emit();
  } catch {
    /* ignore a malformed write */
  }
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  let studies = [];
  let migrated = false;
  try {
    ({ studies, migrated } = readStorage());
  } catch {
    /* corrupted save — start fresh */
  }
  state = { studies, busy: false, ready: true };
  if (migrated) persist();
  window.addEventListener("storage", onStorage);
}

function subscribe(listener) {
  load(); // React re-reads the snapshot right after subscribing, so this lands
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;
const getServerSnapshot = () => SERVER_SNAPSHOT;

/** { studies, busy, ready } — `ready` flips once localStorage has been read. */
export function useStudies() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ── Selectors ─────────────────────────────────────────────────────────────────
export const getStudy = (id) =>
  id == null ? null : state.studies.find((s) => String(s.id) === String(id)) || null;

export const byRecent = (studies) =>
  [...studies]
    .filter((s) => s.blocks.length)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

/**
 * The most recent study started in this series (or, for a message with no
 * series, on this message) — what a lesson's Ask panel resumes.
 */
export function latestStudyFor(studies, { seriesId, sermonId }) {
  return (
    byRecent(studies).find((s) => {
      if (!s.context) return false;
      if (seriesId) return s.context.seriesId === seriesId;
      return !s.context.seriesId && s.context.sermonId === sermonId;
    }) || null
  );
}

// ── Actions ───────────────────────────────────────────────────────────────────

// Prior answered turns in the same study AND scope — series-chat keeps a
// conversation per scope (the route's history is per scope, not per study).
function historyFor(study, scope) {
  if (!study || scope?.type === "all") return [];
  return study.blocks
    .filter((b) => b.status === "done" && b.answer && sameScope(b.scope, scope))
    .flatMap((b) => [
      { role: "user", text: b.question },
      { role: "ai", text: b.answer },
    ]);
}

// Merge a lesson's context into a study: same series → refine it (e.g. the
// current part), different or none → take the new one.
function mergeContext(prev, next) {
  if (!next) return prev || null;
  if (prev && next.seriesId && prev.seriesId === next.seriesId) return { ...prev, ...next };
  return next;
}

/**
 * Ask a question. Starts a new study when `studyId` is null/unknown.
 * Returns { studyId, blockId }, or null when ignored (empty, or one is
 * already streaming — one question at a time, as before).
 */
export function askQuestion({ studyId = null, question, scope = SCOPE_ALL, context = null }) {
  const q = (question || "").trim();
  load();
  if (!q || state.busy) return null;

  const blockId = Date.now();
  const existing = getStudy(studyId);
  const id = existing ? existing.id : blockId;
  const history = historyFor(existing, scope);
  const block = {
    id: blockId,
    question: q,
    scope,
    answer: "",
    segmentMap: {},
    suggestions: [],
    status: "searching",
  };

  update((s) => {
    const base =
      s.studies.find((x) => x.id === id) || {
        id,
        title: titleFrom(q),
        createdAt: blockId,
        context: null,
        blocks: [],
      };
    const study = {
      ...base,
      context: mergeContext(base.context, context),
      updatedAt: blockId,
      blocks: [...base.blocks, block],
    };
    return { busy: true, studies: [study, ...s.studies.filter((x) => x.id !== id)] };
  });
  persist(true);

  streamAnswer(id, blockId, q, scope, history);
  return { studyId: id, blockId };
}

async function streamAnswer(studyId, blockId, question, scope, chatHistory) {
  const patch = (fields) =>
    update((s) => ({
      studies: s.studies.map((st) =>
        st.id !== studyId
          ? st
          : {
              ...st,
              updatedAt: Date.now(),
              blocks: st.blocks.map((b) => (b.id === blockId ? { ...b, ...fields } : b)),
            }
      ),
    }));

  try {
    const { url, body } = requestFor(scope, question, chatHistory);
    const send = () =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...clientIdHeader() },
        body: JSON.stringify(body),
      });

    let res = await send();
    // Gemini returns a transient 503 ("high demand") often enough that one
    // quiet retry saves most of them. Only 503, only once, and only here —
    // before a single word has streamed, so nothing is ever asked twice
    // mid-answer.
    if (res.status === 503) {
      patch({ retrying: true });
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      res = await send();
      patch({ retrying: false });
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const apiErr = new Error(err.message || "Something went wrong.");
      apiErr.isApiMessage = true; // already a full, user-facing sentence
      throw apiErr;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let raw = "";
    let headerParsed = false;
    let segmentMap = {};

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });

      // Wait for the WHOLE SEGMENT_MAP header line before parsing — /api/ask
      // sends ~300-char snippets, so the map can run several KB and span chunks.
      if (!headerParsed) {
        const nl = raw.indexOf("\n");
        if (nl === -1) continue;
        const firstLine = raw.slice(0, nl);
        if (firstLine.startsWith("SEGMENT_MAP:")) {
          try {
            segmentMap = JSON.parse(firstLine.slice("SEGMENT_MAP:".length));
          } catch {
            /* leave sources empty */
          }
          raw = raw.slice(nl + 1);
        }
        headerParsed = true;
      }

      const { answer, suggestions } = splitAnswer(raw);
      patch({ answer, suggestions, segmentMap, status: "answering" });
    }

    patch({ status: "done" });
  } catch (err) {
    patch({
      status: "error",
      answer: err.isApiMessage ? err.message : `I ran into a problem: ${err.message}`,
    });
  } finally {
    update(() => ({ busy: false }));
  }
}

/** Drop a failed block and ask its question again, in the same scope. */
export function retryBlock(studyId, blockId) {
  if (state.busy) return null;
  const study = getStudy(studyId);
  const block = study?.blocks.find((b) => b.id === blockId);
  if (!block) return null;
  update((s) => ({
    studies: s.studies.map((st) =>
      st.id !== study.id ? st : { ...st, blocks: st.blocks.filter((b) => b.id !== blockId) }
    ),
  }));
  return askQuestion({ studyId: study.id, question: block.question, scope: block.scope });
}

/** Delete a study; returns it, for restoreStudy() (Undo). */
export function deleteStudy(id) {
  const removed = getStudy(id);
  update((s) => ({ studies: s.studies.filter((x) => String(x.id) !== String(id)) }));
  return removed;
}

/** Put a deleted study back (lists sort by updatedAt, so it lands where it was). */
export function restoreStudy(study) {
  if (!study) return;
  update((s) => ({ studies: [study, ...s.studies.filter((x) => x.id !== study.id)] }));
}

// ── The study /ask has open (this browser session only) ───────────────────────
// Lets "Ask the Word" mean "take me back to what I was reading". Unavailable
// storage (private mode) just means /ask always opens on the search box.

/** The id of the study /ask last showed this session, or null. */
export function openStudyId() {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(OPEN_KEY);
  } catch {
    return null;
  }
}

export function rememberOpenStudy(id) {
  try {
    sessionStorage.setItem(OPEN_KEY, String(id));
  } catch {
    /* storage unavailable */
  }
}

/** "New study" — the next visit to /ask opens on the search box again. */
export function forgetOpenStudy() {
  try {
    sessionStorage.removeItem(OPEN_KEY);
  } catch {
    /* storage unavailable */
  }
}
