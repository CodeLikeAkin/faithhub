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

// The n8n worker checks in every 30 minutes, so "online" must outlast one missed check.
export const WORKER_ONLINE_MINUTES = 45;
