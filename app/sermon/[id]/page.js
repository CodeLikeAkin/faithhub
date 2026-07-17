"use client";

import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import StudyWorkspace from "@/components/StudyWorkspace";

/**
 * Message page — the unified study workspace, opened in "message" scope on
 * this sermon. Its series (if any) is resolved inside the shell, so the scope
 * toggle can broaden to the whole series live. Sermons with no series render
 * a message-only workspace. See components/StudyWorkspace.js.
 */
export default function SermonPage() {
  const { id } = useParams();
  if (!id)
    return (
      <div className="h-dvh bg-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-navy animate-spin" />
      </div>
    );
  return <StudyWorkspace entry={{ type: "sermon", sermonId: id }} />;
}
