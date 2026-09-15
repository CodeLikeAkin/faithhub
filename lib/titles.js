// Sermon titles arrive as raw YouTube strings like
//   "Then And Now Part 1 - New Creation Realities | Rev Peter Alabi | 7th June 2026"
// and occasionally carry data glitches (the whole prefix duplicated). These
// helpers derive clean display titles so raw strings never reach the UI.

/**
 * The message's own title: drop everything after the first "|" (speaker/date
 * suffix), collapse whitespace, then strip any leading "<Series> Part N -"
 * prefix. The prefix strip is greedy to the LAST "Part N -" occurrence, which
 * also flattens duplicated-prefix glitches in the data.
 */
export function cleanTitle(raw) {
  if (!raw) return "";
  const first = raw.split("|")[0].replace(/\s+/g, " ").trim();
  const stripped = first.replace(/^.*part\s*\d+\s*[-–—:]\s*/i, "").trim();
  return stripped || first;
}

/** "Part N" label if the raw title carries one, else null. */
export function partLabel(raw) {
  const m = (raw || "").match(/part\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/**
 * The true preach date, parsed from the title tail (e.g. "| 19th August
 * 2026"), not `sermon_date` — that column is the YouTube upload date and
 * lags the service by 5-8 days on average (see memory:
 * sermon-date-is-upload-date). Returns null if the title carries no
 * recognizable date.
 */
export function parseSermonDate(raw) {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2})\s*(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = MONTHS[m[2].toLowerCase()];
  const year = parseInt(m[3], 10);
  if (month === undefined || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month, day));
  return isNaN(d.getTime()) ? null : d;
}
