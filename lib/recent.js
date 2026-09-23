// The last lesson (or series) a visitor opened — the home page's "Pick up
// where you left off". Device-local, like saved studies.

const KEY = "hof-last-lesson-v1";

export function readLastLesson() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    return v?.href ? v : null;
  } catch {
    return null;
  }
}

/**
 * entry = { kind: "lesson" | "series", href, title, seriesId?, seriesTitle?,
 *           partNumber?, parts?, videoId?, videoIds? }
 * Opening a series overview doesn't overwrite a lesson in that same series —
 * the lesson is the more precise place to come back to.
 */
export function recordLastLesson(entry) {
  try {
    if (entry.kind === "series") {
      const prev = readLastLesson();
      if (prev?.kind === "lesson" && prev.seriesId && prev.seriesId === entry.seriesId) return;
    }
    localStorage.setItem(KEY, JSON.stringify({ ...entry, at: Date.now() }));
  } catch {
    /* storage unavailable — nothing to continue from */
  }
}
