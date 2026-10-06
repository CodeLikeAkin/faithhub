import BookView from "@/components/word/BookView";
import { BOOKS } from "@/lib/canon";

/** /word/[book] — e.g. /word/romans. See components/word/BookView.js. */

// A server shell so the route can be cached. BookView fetches its own data in
// the browser, so there's nothing per-visitor in this HTML — without these two
// it was the only part of the site Vercel re-rendered on every single request
// (MISS, age=0), leaving each visit exposed to a cold start. /word itself has
// had `revalidate` since it was built; its children were simply missed.
export const revalidate = 3600;

/** All 66 are known from the canon, so prerender them instead of on demand. */
export function generateStaticParams() {
  return BOOKS.map((b) => ({ book: b.slug }));
}

export default function WordBookPage({ params }) {
  return <BookView slug={params.book} />;
}
