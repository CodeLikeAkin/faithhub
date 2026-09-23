"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bookmark, Flame } from "lucide-react";
import ToolShell from "@/components/shell/ToolShell";
import { copyText, useToast } from "@/components/shell/Toast";
import VideoModal from "@/components/VideoModal";
import DeclarationLine from "@/components/declarations/DeclarationLine";
import SpeakMode from "@/components/declarations/SpeakMode";
import SpeakAllBar from "@/components/declarations/SpeakAllBar";
import ThemeChips from "@/components/declarations/ThemeChips";
import { THEMES, restoreSaved, streakLabel, useSavedDeclarations, useStreak } from "@/lib/declarations";

/**
 * /declarations/mine — the believer's own set, built from any theme with the
 * bookmark and spoken daily. Saved on this device (like studies). Speaking
 * it counts toward the streak. `?speak=1` opens straight into Speak mode.
 */
export default function MyDeclarationsPage() {
  const saved = useSavedDeclarations();
  const streak = useStreak();
  const [speaking, setSpeaking] = useState(false);
  const [watching, setWatching] = useState(null);
  const [toast, showToast] = useToast();
  const wantSpeak = useRef(false);

  useEffect(() => {
    document.title = "My declarations · FaithHub";
    wantSpeak.current = new URLSearchParams(window.location.search).get("speak") === "1";
  }, []);

  useEffect(() => {
    if (wantSpeak.current && saved.length) {
      wantSpeak.current = false;
      setSpeaking(true);
    }
  }, [saved.length]);

  // Unsaving from the set itself removes the line — offer Undo.
  const onSaveChange = (nowSaved, declaration) => {
    if (nowSaved) return;
    const index = saved.findIndex((d) => d.id === declaration.id);
    const removed = saved[index] || declaration;
    showToast("Removed from My declarations", { label: "Undo", run: () => restoreSaved(removed, index) });
  };

  const openSpeak = () => {
    setSpeaking(true);
    window.history.replaceState(null, "", "/declarations/mine?speak=1");
  };
  const closeSpeak = () => {
    setSpeaking(false);
    window.history.replaceState(null, "", "/declarations/mine");
  };
  const copy = (text) => copyText(text, showToast);

  return (
    <ToolShell
      kind="declarations"
      back={<Link href="/declarations" className="hover:text-brand-navy">Declarations</Link>}
      title="My declarations"
      titleAs="p"
      coveredByOverlay={speaking}
      overlay={
        <>
          {speaking && saved.length > 0 && (
            <SpeakMode title="My declarations" items={saved} onClose={closeSpeak} onCopy={copy} />
          )}
          {toast}
        </>
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-8">
          <header className="pt-10 sm:pt-14">
            <h1 className="font-display text-5xl font-medium tracking-tight text-brand-ink sm:text-6xl">My declarations</h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-lg text-brand-gray">
              <span>{saved.length ? `${saved.length} saved on this device` : "Your own set, to speak each day"}</span>
              <span className="inline-flex items-center gap-1.5 text-base font-medium text-brand-navy">
                <Flame size={16} aria-hidden="true" />
                {streakLabel(streak)}
              </span>
            </p>
          </header>
          <ThemeChips active="mine" className="mt-8" />

          {saved.length === 0 ? (
            <div className="mt-8 rounded-[1.75rem] border border-brand-navy/10 bg-brand-sky/50 p-6 sm:p-8">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-brand-navy shadow-sm">
                <Bookmark size={20} aria-hidden="true" />
              </span>
              <h2 className="mt-5 font-display text-2xl font-medium text-brand-ink">Build the set you&rsquo;ll speak every day</h2>
              <p className="mt-2 max-w-xl text-base leading-relaxed text-brand-gray">
                Open a theme and tap the bookmark on any declaration that speaks to you. They gather here, and
                one tap on &ldquo;Speak them&rdquo; takes you through them in Speak mode. Each day you speak
                keeps your streak going.
              </p>
              <ul className="mt-6 flex flex-wrap gap-2">
                {THEMES.slice(0, 6).map((t) => (
                  <li key={t.slug}>
                    <Link
                      href={`/declarations/${t.slug}`}
                      className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-medium text-brand-navy shadow-sm hover:bg-brand-sky"
                    >
                      {t.name} <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <ol className="mt-6 divide-y divide-brand-navy/10 border-t border-brand-navy/10">
                {saved.map((d, i) => (
                  <DeclarationLine
                    key={d.id}
                    declaration={d}
                    index={i}
                    onWatch={setWatching}
                    onCopy={copy}
                    onSaveChange={onSaveChange}
                  />
                ))}
              </ol>
              <SpeakAllBar label="Speak my declarations" onSpeak={openSpeak} />
            </>
          )}
          {saved.length === 0 && <div className="h-24" />}
        </div>
      </div>
      <VideoModal seg={watching} onClose={() => setWatching(null)} />
    </ToolShell>
  );
}
