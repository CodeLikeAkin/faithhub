"use client";

import { useParams } from "next/navigation";
import LessonPage from "@/components/lesson/LessonPage";

/**
 * /sermon/[id] — a message as a lesson: embedded player, the series as a
 * numbered course, then notes / scriptures / word studies / declarations as
 * one page, with an Ask panel beside it. `?t=<seconds>` starts the player
 * there. Sermons in no series render as a single lesson.
 * See components/lesson/LessonPage.js.
 */
export default function SermonPage() {
  const { id } = useParams();
  if (!id) return <div className="h-dvh bg-white" />;
  return <LessonPage sermonId={id} />;
}
