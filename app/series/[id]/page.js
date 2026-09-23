"use client";

import { useParams } from "next/navigation";
import SeriesOverview from "@/components/lesson/SeriesOverview";

/**
 * /series/[id] — a series as a course overview (cover, what it teaches, its
 * parts in order, key scriptures, declarations) with an Ask panel scoped to
 * the whole series. Each part opens its lesson at /sermon/[id].
 * See components/lesson/SeriesOverview.js.
 */
export default function SeriesDetailPage() {
  const { id } = useParams();
  if (!id) return <div className="h-dvh bg-white" />;
  return <SeriesOverview seriesId={id} />;
}
