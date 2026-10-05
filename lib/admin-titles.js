// Title and date tidy-ups for admin lists (server and browser).

import { cleanTitle, parseSermonDate } from "@/lib/titles";
import { detectSpeaker, isMultiVoice } from "@/lib/speakers";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const partsFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Africa/Lagos" });

/** "2 Sep 2026": the preach date from the title, else the upload date (en-GB's own "Sept" sits oddly next to the rest). */
export function preachedOn(s) {
  const d = parseSermonDate(s.title) || (s.sermon_date ? new Date(s.sermon_date) : null);
  if (!d || Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]} ${p.year}`;
}

const DATE_SEGMENT = /\b\d{1,2}\s*(st|nd|rd|th)?\s+[a-z]+,?\s+\d{4}\b/i;

/**
 * Newer uploads use " - " instead of "|" between the title, the session, the
 * preacher and the date, so cleanTitle() leaves all of it in. Split it back
 * out: preacher and date are already shown on the meta line, the session
 * ("Day 1 Morning, HCM 2026") becomes context.
 */
export function splitTitle(raw) {
  const clean = cleanTitle(raw);
  const segs = clean
    .split(/\s+[-–]\s+/)
    .map((x) => x.trim())
    .filter((x) => x && !DATE_SEGMENT.test(x) && !detectSpeaker(x).name);
  if (!segs.length) return { title: clean, context: null };
  let title = segs[0];
  let rest = segs.slice(1);
  while (rest[0]?.startsWith("(")) title = `${title} ${rest.shift()}`; // "Enlarged (A Charge)"
  return { title, context: rest.join(", ") || null };
}

export const speakerOf = (raw) => detectSpeaker(raw).name;

/**
 * How Ask the Word and Declarations will treat a message, read from its title
 * the same way they do (lib/speakers.js). A guest's messages and celebration /
 * panel videos are left out of both unless someone names the guest, so a
 * mistyped title would hide a message nobody notices is missing; this shows the
 * decision before the message goes live.
 *   guest    — a guest minister is named
 *   panel    — celebration, tribute or panel video (no one preacher)
 *   unnamed  — no speaker in the title, so it counts as Dad's
 * Returns { kind, text } or null for a message named as Dad or Mom.
 */
export function askStatus(raw) {
  if (isMultiVoice(raw)) return { kind: "panel", text: "Celebration or panel, hidden from Ask the Word" };
  const s = detectSpeaker(raw);
  if (s.isGuest) return { kind: "guest", text: `Guest: ${s.name}, hidden from Ask the Word` };
  if (!s.name) return { kind: "unnamed", text: "No speaker in the title, counted as Dad" };
  return null;
}

/** A video that won't play for visitors. */
export const isDeadVideo = (status) => status === "private" || status === "deleted";
