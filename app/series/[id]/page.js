"use client";

import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import StudyWorkspace from "@/components/StudyWorkspace";

/**
 * Series studio — the unified study workspace, opened in "series" scope.
 * The toggle inside can narrow it to a single message (rewriting the URL to
 * /sermon/[id] without a reload); the message page boots the same shell in
 * "message" scope. See components/StudyWorkspace.js.
 */
export default function SeriesDetailPage() {
  const { id } = useParams();
  if (!id)
    return (
      <div className="h-dvh bg-brand-light flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-navy animate-spin" />
      </div>
    );
  return <StudyWorkspace entry={{ type: "series", seriesId: id }} />;
}
