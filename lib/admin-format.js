// Small display formatters shared by the admin pages (server and browser).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2 Sep 2026" in Lagos time. */
export function fmtDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Africa/Lagos" })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]} ${p.year}`;
}

/** "1 hr 32 min", "48 min", "Live or not known". */
export function fmtDuration(seconds) {
  if (!seconds) return "Length not known";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h} hr ${m} min` : `${m} min`;
}

/** "just now", "4 min ago", "3 hr ago", "2 days ago". */
export function timeAgo(value, now = Date.now()) {
  if (!value) return "";
  const mins = Math.max(0, Math.round((now - new Date(value).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h} hr ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** Minutes since a timestamp, or null. */
export function minutesSince(value, now = Date.now()) {
  if (!value) return null;
  return Math.max(0, Math.round((now - new Date(value).getTime()) / 60000));
}

/**
 * Where a message stands on declarations, counted the way the Declarations
 * page sees them (admin_declarations_none.sql):
 *   have     some are on the Declarations page
 *   kept     it has some, all kept off that page (a guest, a celebration
 *            video); they still show on the message's own page
 *   none     checked on the admin page: none needed
 *   missing  none yet, waiting for the careful pass
 */
export function declarationState({ declarations, declarations_kept, declarations_none }) {
  if (declarations > 0) return "have";
  if (declarations_kept > 0) return "kept";
  if (declarations_none) return "none";
  return "missing";
}

/**
 * When a study piece is missing, for the Messages board and the dashboard's
 * readiness card alike. Every piece but the transcript is made from the
 * transcript, so a message without one only counts as missing its transcript;
 * the rest wait until it has one. Takes a row of admin_messages().
 */
const PIECE_GAPS = {
  search: (m) => !m.search,
  scriptures: (m) => !m.scriptures,
  declarations: (m) => declarationState(m) === "missing",
  notes: (m) => !!m.series_id && !m.notes,
  words: (m) => !m.word_studies && !m.word_studies_none,
};
export const PIECE_KEYS = Object.keys(PIECE_GAPS);
export const pieceMissing = (key, m) => !!m.transcript && PIECE_GAPS[key](m);

// The n8n worker checks in every 30 minutes, so "online" must outlast one missed check.
export const WORKER_ONLINE_MINUTES = 45;
