"use client";

import { useParams } from "next/navigation";
import ChapterView from "@/components/word/ChapterView";

/** /word/[book]/[chapter] — e.g. /word/romans/8 (#v28 jumps to a verse). See components/word/ChapterView.js. */
export default function WordChapterPage() {
  const { book, chapter } = useParams();
  return <ChapterView slug={book} chapter={chapter} />;
}
