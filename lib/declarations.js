"use client";

// Declarations — the library's themes and queries, "My declarations" (the
// saved set a believer returns to daily) and the speaking streak.
//
// Browsing a theme is a FILTER over the fixed topic_tags taxonomy, not
// retrieval (CLAUDE.md rule 2): pages read `declarations` by tag directly —
// no embedding, no LLM. Only "What are you facing?" goes through
// /api/declarations (embed → hybrid RPC → Groq reply), unchanged.

import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";

// The ten biggest tags in the data, largest first (2026-09: faith 3,080 …
// relationships 198). Slug = the topic_tags value.
export const THEMES = [
  { slug: "faith", name: "Faith", sub: "When you need to believe again" },
  { slug: "identity", name: "Identity", sub: "Who you are in Christ" },
  { slug: "strength", name: "Strength", sub: "When you are weary" },
  { slug: "blessing", name: "Blessing", sub: "Walking in God’s favour" },
  { slug: "purpose", name: "Purpose", sub: "Direction and calling" },
  { slug: "mindset", name: "Mindset", sub: "Renewing the mind" },
  { slug: "healing", name: "Healing", sub: "Health and wholeness" },
  { slug: "finances", name: "Finances", sub: "Provision and increase" },
  { slug: "fear", name: "Fear", sub: "Peace over anxiety" },
  { slug: "relationships", name: "Relationships", sub: "Family and connection" },
];

export const themeBySlug = (slug) => THEMES.find((t) => t.slug === String(slug || "").toLowerCase()) || null;

/** One shape for a declaration, whichever query or route it came from. */
export function normalizeDeclaration(d) {
  return {
    id: d.id,
    declaration_text: d.declaration_text,
    youtube_url_with_timestamp: d.youtube_url_with_timestamp || "",
    sermon_id: d.sermon_id || null,
    sermon_title: d.sermon_title || d.sermons?.title || null,
  };
}

// Declarations come from Dad and Mom: a guest minister's and a celebration /
// panel video's declarations are not library declarations. That is a fact about
// each row, stored on it (declarations.in_library — see
// supabase/migrations/declarations_in_library.sql), so every query here just
// says so. Nothing works out who preached at request time.
//
// A guest's own message page is NOT this: it reads that one sermon's
// declarations by sermon_id and shows all of them (components/lesson/
// useSeriesBundle.js). This filter is the library's, not a blanket ban.
const libraryOnly = (query) => query.eq("in_library", true);

const LIST_SELECT = "id, declaration_text, youtube_url_with_timestamp, sermon_id, sermons ( title, sermon_date )";

/**
 * A page of one theme, newest teaching first. Stable order (unlike the
 * random topic RPC the chat used) so paging covers every declaration once.
 */
export async function fetchThemePage(slug, from, size) {
  const base = () => libraryOnly(supabase.from("declarations").select(LIST_SELECT).contains("topic_tags", [slug]));
  let { data, error } = await base()
    .order("sermons(sermon_date)", { ascending: false, nullsFirst: false })
    .order("id")
    .range(from, from + size - 1);
  if (error) {
    // Ordering by the related sermon is a newer PostgREST feature — fall back
    // to a plain stable order rather than failing the page.
    ({ data, error } = await base().order("created_at", { ascending: false }).order("id").range(from, from + size - 1));
  }
  if (error) throw error;
  return (data || []).map(normalizeDeclaration);
}

// ── The daily set ─────────────────────────────────────────────────────────────
// One theme leads each day and every theme shows 8 declarations for the day —
// the same for everyone, changing at midnight in Lagos.

/** Days since 1970-01-01 on the church's calendar (Africa/Lagos), so the whole church turns over together. */
export function dayNumber(date = new Date()) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(date).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// A small seeded shuffle, so a cycle's theme order is the same on every device.
function seededOrder(seed) {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const order = THEMES.map((t) => t.slug);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * The theme that leads on a given day. Every theme leads once in each run of
 * ten days, in a fresh order each run — and never two days in a row across
 * the seam between runs.
 */
export function themeOfDay(day = dayNumber()) {
  const n = THEMES.length;
  const cycle = Math.floor(day / n);
  const order = seededOrder(cycle);
  if (order[0] === seededOrder(cycle - 1)[n - 1]) [order[0], order[1]] = [order[1], order[0]];
  return order[day % n];
}

/**
 * A theme's declarations for one day — the `declarations_for_day` RPC (quality
 * rules, a fixed shuffle, 8 a day with no repeats until the pool runs out).
 * Until that SQL has been run, a plain rotation through the theme stands in.
 */
export async function fetchThemeForDay(slug, day = dayNumber(), size = 8) {
  // The RPC filters on in_library itself, so a day's set is a full `size`
  // again — filtering its result here used to leave the day a card short
  // whenever one of its picks was a guest's.
  const { data, error } = await supabase.rpc("declarations_for_day", { topic: slug, day_number: day, match_count: size });
  if (!error) return (data || []).map(normalizeDeclaration);
  const total = await fetchThemeCount(slug);
  return fetchThemePage(slug, total ? (day * size) % Math.max(1, total - size) : 0, size);
}

export async function fetchThemeCount(slug) {
  const { count, error } = await libraryOnly(
    supabase.from("declarations").select("id", { count: "exact", head: true }).contains("topic_tags", [slug])
  );
  return error ? null : count;
}

/**
 * Today's declaration — the same deterministic day-of-year pick over a stable
 * sample that the home page has always shown, so both agree.
 */
export async function fetchTodaysDeclaration() {
  let { data, error } = await libraryOnly(
    supabase
      .from("declarations")
      .select("id, declaration_text, youtube_url_with_timestamp, sermon_id, sermons ( title )")
  )
    .order("id")
    .limit(100);
  if (error) {
    // Relation join can fail if FK metadata differs — retry flat.
    ({ data, error } = await libraryOnly(
      supabase.from("declarations").select("id, declaration_text, youtube_url_with_timestamp, sermon_id")
    )
      .order("id")
      .limit(100));
  }
  if (error || !data?.length) return null;
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  return normalizeDeclaration(data[dayOfYear % data.length]);
}

// ── Small external stores (saved set, streak) ─────────────────────────────────
function createStore(read, serverValue) {
  let value = serverValue;
  let loaded = false;
  const listeners = new Set();
  const emit = () => listeners.forEach((l) => l());
  const load = () => {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    value = read();
  };
  return {
    get: () => {
      load();
      return value;
    },
    set: (next) => {
      value = next;
      emit();
    },
    reload: () => {
      value = read();
      emit();
    },
    subscribe: (l) => {
      load();
      listeners.add(l);
      return () => listeners.delete(l);
    },
    snapshot: () => value,
    server: () => serverValue,
  };
}

// ── My declarations (device-local, like saved studies) ────────────────────────
const SAVED_KEY = "hof-decl-saved-v1";
const MAX_SAVED = 300;
const NO_SAVED = Object.freeze([]);

const readSaved = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((d) => d && d.id && d.declaration_text) : [];
  } catch {
    return [];
  }
};
const savedStore = createStore(readSaved, NO_SAVED);

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => e.key === SAVED_KEY && savedStore.reload());
}

function writeSaved(next) {
  savedStore.set(next);
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  } catch {
    /* storage full or unavailable — the set just won't persist */
  }
}

export function useSavedDeclarations() {
  return useSyncExternalStore(savedStore.subscribe, savedStore.snapshot, savedStore.server);
}

/** Save or unsave; returns true when it's now saved. */
export function toggleSaved(declaration) {
  const current = savedStore.get();
  if (current.some((d) => d.id === declaration.id)) {
    writeSaved(current.filter((d) => d.id !== declaration.id));
    return false;
  }
  writeSaved([{ ...normalizeDeclaration(declaration), savedAt: Date.now() }, ...current].slice(0, MAX_SAVED));
  return true;
}

/** Put a removed declaration back where it was (undo). */
export function restoreSaved(declaration, index) {
  const current = savedStore.get().filter((d) => d.id !== declaration.id);
  const next = [...current];
  next.splice(Math.max(0, Math.min(index, next.length)), 0, declaration);
  writeSaved(next.slice(0, MAX_SAVED));
}

// ── Speaking streak ───────────────────────────────────────────────────────────
// A day counts when declarations are actually spoken (Speak mode opens).
// Same storage key and { count, last } shape as the old visit streak, so
// existing streaks carry over.
const STREAK_KEY = "hof-decl-streak";
const localDay = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const NO_STREAK = Object.freeze({ count: 0, spokeToday: false });

const readStreak = () => {
  try {
    const s = JSON.parse(localStorage.getItem(STREAK_KEY) || "null");
    if (!s?.last) return NO_STREAK;
    const today = localDay(new Date());
    const yesterday = localDay(new Date(Date.now() - 86400000));
    if (s.last === today) return { count: s.count || 1, spokeToday: true };
    if (s.last === yesterday) return { count: s.count || 1, spokeToday: false }; // alive until tonight
    return NO_STREAK;
  } catch {
    return NO_STREAK;
  }
};
const streakStore = createStore(readStreak, NO_STREAK);

export function useStreak() {
  return useSyncExternalStore(streakStore.subscribe, streakStore.snapshot, streakStore.server);
}

/** Mark today as a speaking day. */
export function recordSpeakDay() {
  try {
    const today = localDay(new Date());
    const yesterday = localDay(new Date(Date.now() - 86400000));
    const s = JSON.parse(localStorage.getItem(STREAK_KEY) || "null");
    let count = 1;
    if (s?.last === today) count = s.count || 1;
    else if (s?.last === yesterday) count = (s.count || 0) + 1;
    localStorage.setItem(STREAK_KEY, JSON.stringify({ count, last: today }));
  } catch {
    /* the streak is a nicety — ignore storage failures */
  }
  streakStore.reload();
}

export function streakLabel({ count, spokeToday }) {
  if (!count) return "Speak today to start a streak";
  const days = `${count}-day streak`;
  return spokeToday ? `${days} · spoken today` : `${days} · speak today to keep it`;
}
