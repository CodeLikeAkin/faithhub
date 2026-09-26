"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Btn, Notice } from "@/components/admin/controls";
import { adminFetch } from "@/lib/admin-client";

/** Checks videos never checked (or whose last check failed), 25 per click. */
export default function CheckVideosButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  async function run() {
    setBusy(true);
    setNote(null);
    try {
      const r = await adminFetch("/api/admin/videos", { method: "POST", body: { action: "check" } });
      const bad = r.counts.private + r.counts.deleted;
      setNote({
        tone: "success",
        text: r.checked
          ? `Checked ${r.checked} ${r.checked === 1 ? "video" : "videos"}: ${r.counts.ok} play${bad ? `, ${bad} won't play` : ""}.`
          : "Every video has already been checked.",
      });
      router.refresh();
    } catch (e) {
      setNote({ tone: "error", text: e.message });
    }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <Btn variant="secondary" size="sm" icon={RefreshCw} busy={busy} onClick={run}>
        Check videos now
      </Btn>
      <Notice tone={note?.tone}>{note?.text}</Notice>
    </div>
  );
}
