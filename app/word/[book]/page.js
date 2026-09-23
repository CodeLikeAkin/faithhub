"use client";

import { useParams } from "next/navigation";
import BookView from "@/components/word/BookView";

/** /word/[book] — e.g. /word/romans. See components/word/BookView.js. */
export default function WordBookPage() {
  const { book } = useParams();
  return <BookView slug={book} />;
}
