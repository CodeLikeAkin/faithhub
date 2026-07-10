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
