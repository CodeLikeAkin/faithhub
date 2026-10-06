import ChapterView from "@/components/word/ChapterView";

/** /word/[book]/[chapter] — e.g. /word/romans/8 (#v28 jumps to a verse). See components/word/ChapterView.js. */

// Same as the book route: a server shell with no per-visitor content, so it
// can be cached rather than re-rendered for every request. Not prerendered —
// that would be ~1,189 pages for a shell the browser fills in anyway; the
// first visit to each chapter warms it.
export const revalidate = 3600;

export default function WordChapterPage({ params }) {
  return <ChapterView slug={params.book} chapter={params.chapter} />;
}
