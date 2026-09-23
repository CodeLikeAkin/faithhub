"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Loader2, RotateCcw } from "lucide-react";
import ToolShell from "@/components/shell/ToolShell";
import { copyText, useToast } from "@/components/shell/Toast";
import VideoModal from "@/components/VideoModal";
import DeclarationLine from "@/components/declarations/DeclarationLine";
import SpeakMode from "@/components/declarations/SpeakMode";
import SpeakAllBar from "@/components/declarations/SpeakAllBar";
import ThemeChips from "@/components/declarations/ThemeChips";
import { fetchThemeCount, fetchThemePage, themeBySlug } from "@/lib/declarations";

const PAGE = 30;

/**
 * /declarations/[theme] — every declaration on one theme (a topic_tags
 * filter, newest teaching first), 30 at a time, each with watch / copy /
 * save, and a sticky "Speak all". `?speak=1` opens straight into Speak mode.
 */
export default function ThemePage() {
  const { theme: slug } = useParams();
  const theme = themeBySlug(slug);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [done, setDone] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [count, setCount] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [watching, setWatching] = useState(null);
  const [toast, showToast] = useToast();
  const wantSpeak = useRef(false);

  const loadFirst = useCallback(async () => {
    if (!theme) return;
    setStatus("loading");
    try {
      const rows = await fetchThemePage(theme.slug, 0, PAGE);
      setItems(rows);
      setDone(rows.length < PAGE);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [theme]);

  useEffect(() => {
    if (!theme) return;
    document.title = `${theme.name} · Declarations`;
    wantSpeak.current = new URLSearchParams(window.location.search).get("speak") === "1";
    setItems([]);
    setDone(false);
    setCount(null);
    loadFirst();
    fetchThemeCount(theme.slug).then(setCount);
  }, [theme, loadFirst]);

  useEffect(() => {
    if (status === "ready" && wantSpeak.current && items.length) {
      wantSpeak.current = false;
      setSpeaking(true);
    }
  }, [status, items.length]);

  const loadMore = async () => {
    if (loadingMore || done) return;
    setLoadingMore(true);
    try {
      const rows = await fetchThemePage(theme.slug, items.length, PAGE);
      setItems((prev) => {
        const seen = new Set(prev.map((d) => d.id));
        return [...prev, ...rows.filter((d) => !seen.has(d.id))];
      });
      setDone(rows.length < PAGE);
    } catch {
      showToast("Couldn’t load more just now — try again.");
    } finally {
      setLoadingMore(false);
    }
  };

  const openSpeak = () => {
    setSpeaking(true);
    window.history.replaceState(null, "", `/declarations/${theme.slug}?speak=1`);
  };
  const closeSpeak = () => {
    setSpeaking(false);
    window.history.replaceState(null, "", `/declarations/${theme.slug}`);
  };
  const copy = (text) => copyText(text, showToast);

  return (
    <ToolShell
      kind="declarations"
      back={<Link href="/declarations" className="hover:text-brand-navy">Declarations</Link>}
      title={theme ? theme.name : "Theme"}
      titleAs="p"
      coveredByOverlay={speaking}
      overlay={
        <>
          {speaking && items.length > 0 && (
            <SpeakMode
              title={`${theme.name} declarations`}
              items={items}
              onClose={closeSpeak}
              onCopy={copy}
              canLoadMore={!done}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
            />
          )}
          {toast}
        </>
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-8">
          {!theme ? (
            <div className="py-24 text-center">
              <h1 className="font-display text-3xl font-medium text-brand-ink">We don&rsquo;t have that theme</h1>
              <Link
                href="/declarations"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-bold text-white hover:bg-brand-deep"
              >
                All declarations <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <>
              <header className="pt-10 sm:pt-14">
                <h1 className="font-display text-5xl font-medium tracking-tight text-brand-ink sm:text-6xl">{theme.name}</h1>
                <p className="mt-3 text-lg text-brand-gray">
                  {theme.sub}
                  {count != null && ` · ${count.toLocaleString()} declarations from Rev. Peter’s messages`}
                </p>
              </header>
              <ThemeChips active={theme.slug} className="mt-8" />

              {status === "loading" && (
                <div aria-hidden="true" className="mt-8 space-y-8">
                  {[92, 80, 96, 70].map((w) => (
                    <div key={w} className="h-7 rounded-full bg-brand-sky motion-safe:animate-pulse" style={{ width: `${w}%` }} />
                  ))}
                </div>
              )}

              {status === "error" && (
                <div role="alert" className="mt-8 rounded-[1.5rem] border border-brand-navy/15 bg-brand-light p-5 sm:p-6">
                  <p className="text-base text-brand-ink/90">Couldn&rsquo;t load these declarations just now.</p>
                  <button
                    type="button"
                    onClick={loadFirst}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand-navy/20 bg-white px-4 py-2 text-sm font-bold text-brand-navy hover:bg-brand-sky"
                  >
                    <RotateCcw size={14} aria-hidden="true" />
                    Try again
                  </button>
                </div>
              )}

              {status === "ready" && (
                <>
                  <ol className="mt-6 divide-y divide-brand-navy/10 border-t border-brand-navy/10">
                    {items.map((d, i) => (
                      <DeclarationLine key={d.id} declaration={d} index={i} onWatch={setWatching} onCopy={copy} />
                    ))}
                  </ol>
                  <div className="border-t border-brand-navy/10 pt-6 text-center">
                    {done ? (
                      <p className="text-sm text-brand-gray">That&rsquo;s every declaration on {theme.name.toLowerCase()}.</p>
                    ) : (
                      <button
                        type="button"
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="inline-flex items-center gap-2 rounded-full border border-brand-navy/15 px-5 py-2.5 text-sm font-semibold text-brand-navy hover:bg-brand-sky disabled:opacity-60"
                      >
                        {loadingMore && <Loader2 size={15} className="motion-safe:animate-spin" aria-hidden="true" />}
                        {loadingMore ? "Loading…" : `Show ${PAGE} more`}
                      </button>
                    )}
                  </div>
                  <SpeakAllBar label={`Speak all ${theme.name.toLowerCase()} declarations`} onSpeak={openSpeak} disabled={!items.length} />
                </>
              )}
            </>
          )}
        </div>
      </div>
      <VideoModal seg={watching} onClose={() => setWatching(null)} />
    </ToolShell>
  );
}
