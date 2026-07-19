"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  Send,
  Play,
  Pause,
  Plus,
  Loader2,
  Copy,
  Quote,
  Flame,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cleanTitle } from "@/lib/titles";
import { parseYoutubeUrl } from "@/lib/youtube";
import VideoModal from "@/components/VideoModal";
import ThemeToggle from "@/components/ThemeToggle";

/**
 * Faith Declarations — a chat-first devotional surface in two screens on one
 * URL. Home leads with Today's declaration and puts the ask box front and
 * center with the eight themes as tap-to-ask suggestion pills beneath it.
 * Asking (by pill, chip, or typing) never navigates: the request becomes a
 * sent bubble and Rev. Peter's declarations come back as a response card in
 * the same thread, ten at a time, with Speak mode and "More declarations".
 */

const TOPICS = [
  { name: "Faith", sub: "When you need to believe again" },
  { name: "Healing", sub: "Health & wholeness" },
  { name: "Finances", sub: "Provision & increase" },
  { name: "Fear", sub: "Peace over anxiety" },
  { name: "Purpose", sub: "Direction & calling" },
  { name: "Relationships", sub: "Family & connection" },
  { name: "Strength", sub: "When you are weary" },
  { name: "Mindset", sub: "Renewing the mind" },
];

const STREAK_KEY = "hof-decl-streak";
const localDay = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const GOLD = "#B8862F";
const GOLD_ON_NAVY = "#D9BE7E";

/**
 * A single declaration as a litany line inside the response card: a serif
 * numeral, the proclamation in serif at reading-aloud size, the source moment
 * beneath it, and a quiet copy icon next to the Watch affordance.
 */
function DeclarationRow({ declaration, index, onCopy, onWatch }) {
  const parsed = parseYoutubeUrl(declaration.youtube_url_with_timestamp);
  return (
    <div
      className="flex items-start gap-3 sm:gap-4 px-5 sm:px-7 py-5 animate-in fade-in duration-500"
      style={{ animationDelay: `${Math.min(index, 10) * 55}ms`, animationFillMode: "backwards" }}
    >
      <span className="font-serif text-[17px] tabular-nums w-6 text-center flex-shrink-0 pt-0.5 text-brand-navy/35">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <blockquote className="font-serif text-[16.5px] sm:text-[19px] leading-[1.45] text-brand-ink max-w-[40ch]">
          {declaration.declaration_text}
        </blockquote>
        <span className="mt-2 flex items-center gap-1.5 min-w-0 text-[12px] text-brand-gray">
          <Play size={8} style={{ color: GOLD }} className="flex-shrink-0" fill="currentColor" />
          <span className="truncate max-w-[200px] sm:max-w-[320px] font-semibold">
            {cleanTitle(declaration.sermon_title)}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
        <button
          onClick={() => onCopy(declaration.declaration_text)}
          title="Copy this declaration"
          aria-label="Copy this declaration"
          className="w-8 h-8 rounded-full text-brand-gray flex items-center justify-center hover:bg-brand-sky hover:text-brand-navy transition-colors"
        >
          <Copy size={13} />
        </button>
        {parsed && (
          <button
            type="button"
            onClick={() => onWatch({ ...parsed, sermon_title: declaration.sermon_title })}
            className="inline-flex items-center gap-1.5 h-[33px] rounded-full px-3.5 text-[12.5px] font-semibold text-brand-ink bg-card border border-brand-navy/15 hover:bg-brand-sky hover:border-brand-navy/40 transition-colors"
          >
            <Play size={9} style={{ color: GOLD }} fill="currentColor" />
            <span className="hidden sm:inline">Watch</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Speak mode — a full-screen focus view for proclaiming declarations one at a
 * time, distraction-free. Arrow keys / on-screen arrows move between them; the
 * source and a "Watch the moment" affordance stay within reach.
 */
function SpeakMode({ items, onClose, onCopy, onWatch, canLoadMore, loadingMore, onLoadMore }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const move = (n) => setI((p) => (p + n + items.length) % items.length);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") move(1);
      else if (e.key === "ArrowLeft") move(-1);
      else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length]);

  // Auto-advance slideshow — press play and the declarations slide by on a
  // reading-aloud pace (longer lines get more time). The timer restarts on any
  // manual navigation so a skip doesn't get cut short.
  useEffect(() => {
    if (!playing) return;
    const secs = Math.min(16, Math.max(7, items[i].declaration_text.length / 14));
    const t = setTimeout(() => move(1), secs * 1000);
    return () => clearTimeout(t);
  }, [playing, i, items]);

  const d = items[i];
  const parsed = parseYoutubeUrl(d.youtube_url_with_timestamp);

  // The proclamation is the whole screen, so its size has to flex with its
  // length — a short line can fill the view, but a long one must scale down
  // (and the stage scrolls as a final safety net) so nothing is ever cut off
  // and the navigation stays in reach.
  const len = d.declaration_text.length;
  const declSize =
    len > 190
      ? "clamp(19px, 3.4vw, 30px)"
      : len > 130
      ? "clamp(22px, 4vw, 36px)"
      : len > 80
      ? "clamp(26px, 4.8vw, 42px)"
      : len > 45
      ? "clamp(30px, 5.4vw, 48px)"
      : "clamp(32px, 6vw, 54px)";

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col px-6 pt-6 pb-6 text-white animate-in fade-in duration-300"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 0%, #173A68 0%, #102A4E 55%, #0A1B30 100%)",
      }}
    >
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: GOLD_ON_NAVY }}>
          Speak mode
        </span>
        <span className="text-[11px] font-semibold text-white/40 tabular-nums">
          {i + 1} / {items.length}
        </span>
        <button
          onClick={onClose}
          aria-label="Close speak mode"
          className="ml-auto w-10 h-10 rounded-xl border border-white/20 bg-white/5 text-white flex items-center justify-center hover:bg-white/15 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center text-center pt-2 pb-6 custom-scrollbar">
        <div
          key={i}
          className="w-full max-w-[94vw] sm:max-w-[80vw] lg:max-w-[900px] m-auto -translate-y-5 animate-in fade-in slide-in-from-right-8 duration-500"
        >
          <blockquote
            className="font-serif font-medium leading-[1.18] tracking-tight text-balance mx-auto max-w-[20ch]"
            style={{ fontSize: declSize }}
          >
            &ldquo;{d.declaration_text}&rdquo;
          </blockquote>
          {d.sermon_title && (
            <p className="mt-7 text-[13px] text-white/60">
              From{" "}
              <span className="font-semibold text-white/85">
                {cleanTitle(d.sermon_title)}
              </span>
            </p>
          )}
          <div className="mt-6 flex items-center justify-center gap-2.5 flex-wrap">
            <button
              onClick={() => onCopy(d.declaration_text)}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/25 px-4 py-2 text-[12px] font-bold text-white hover:bg-white/20 transition-colors"
            >
              <Copy size={12} />
              Copy
            </button>
            {parsed && (
              <button
                onClick={() => onWatch({ ...parsed, sermon_title: d.sermon_title })}
                className="inline-flex items-center gap-1.5 rounded-full bg-white text-brand-navy px-4 py-2 text-[12px] font-bold hover:bg-brand-sky transition-colors"
              >
                <Play size={11} fill="currentColor" />
                Watch the moment
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 flex-shrink-0">
        {/* Progress — dots while the set is small, a slim bar once it grows */}
        {items.length <= 14 ? (
          <div className="flex items-center gap-2">
            {items.map((_, idx) => (
              <span
                key={idx}
                className="h-[7px] rounded-full transition-all"
                style={{
                  width: idx === i ? 22 : 7,
                  background: idx === i ? GOLD_ON_NAVY : "rgba(255,255,255,0.28)",
                }}
              />
            ))}
          </div>
        ) : (
          <div className="w-[200px] h-[5px] rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${((i + 1) / items.length) * 100}%`,
                background: GOLD_ON_NAVY,
              }}
            />
          </div>
        )}

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => move(-1)}
            aria-label="Previous declaration"
            className="w-12 h-12 rounded-full border border-white/25 bg-white/5 text-white flex items-center justify-center hover:bg-white/15 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause slideshow" : "Play slideshow"}
            title={playing ? "Pause" : "Play — declarations slide on their own"}
            className="w-16 h-16 rounded-full flex items-center justify-center text-brand-navy hover:scale-105 transition-transform shadow-lg shadow-black/30"
            style={{ background: GOLD_ON_NAVY }}
          >
            {playing ? (
              <Pause size={24} fill="currentColor" />
            ) : (
              <Play size={24} fill="currentColor" className="ml-1" />
            )}
          </button>
          <button
            onClick={() => move(1)}
            aria-label="Next declaration"
            className="w-12 h-12 rounded-full border border-white/25 bg-white/5 text-white flex items-center justify-center hover:bg-white/15 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
          {canLoadMore && (
            <button
              onClick={onLoadMore}
              disabled={loadingMore}
              aria-label="Load 10 more declarations"
              className="inline-flex items-center gap-1.5 h-12 rounded-full border border-white/25 bg-white/5 px-4 text-[13px] font-bold text-white hover:bg-white/15 transition-colors disabled:opacity-60"
            >
              {loadingMore ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              10 more
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DeclarationsPage() {
  const router = useRouter();
  const [messages, setMessages] = useState([]); // { id, role, text, title?, declarations? }
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [outOfResults, setOutOfResults] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [lastTopic, setLastTopic] = useState(null);
  const [toast, setToast] = useState(null);
  const [featured, setFeatured] = useState(null); // today's declaration
  const [streak, setStreak] = useState(0);
  const [watching, setWatching] = useState(null); // segment currently open in the video modal
  const [speakMsgId, setSpeakMsgId] = useState(null); // AI message whose declarations are open in speak mode (live — grows with +10)
  const textareaRef = useRef(null);
  const threadRef = useRef(null);
  const userMessageRefs = useRef({});
  const toastTimer = useRef(null);

  const hasSearched = messages.length > 0;

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Today's declaration (day-of-year rotation, matches DeclarationOfTheDay) +
  // the local visit streak. Both run once, client-side.
  useEffect(() => {
    // Streak
    try {
      const today = localDay(new Date());
      const yesterday = localDay(new Date(Date.now() - 86400000));
      let count = 1;
      const raw = localStorage.getItem(STREAK_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.last === today) count = saved.count;
        else count = saved.last === yesterday ? saved.count + 1 : 1;
      }
      localStorage.setItem(STREAK_KEY, JSON.stringify({ count, last: today }));
      setStreak(count);
    } catch {
      /* streak is a nicety — ignore storage failures */
    }

    // Today's declaration
    let cancelled = false;
    (async () => {
      try {
        let { data, error } = await supabase
          .from("declarations")
          .select("id, declaration_text, youtube_url_with_timestamp, sermons ( title )")
          .order("id")
          .limit(100);
        if (error) {
          ({ data, error } = await supabase
            .from("declarations")
            .select("id, declaration_text, youtube_url_with_timestamp")
            .order("id")
            .limit(100));
        }
        if (error || !data?.length || cancelled) return;
        const now = new Date();
        const dayOfYear = Math.floor(
          (now - new Date(now.getFullYear(), 0, 0)) / 86400000
        );
        const d = data[dayOfYear % data.length];
        setFeatured({
          declaration_text: d.declaration_text,
          youtube_url_with_timestamp: d.youtube_url_with_timestamp,
          sermon_title: d.sermons?.title || null,
        });
      } catch {
        /* stay hidden */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input, hasSearched]);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  };

  const copyDeclaration = async (text) => {
    try {
      await navigator.clipboard.writeText(`"${text}"`);
      showToast("Declaration copied");
    } catch {
      showToast("Couldn't copy — clipboard unavailable");
    }
  };

  const handleTopicClick = (topic) => {
    startSearch(`I need declarations about ${topic.toLowerCase()}`, topic, topic.toLowerCase());
  };

  const goHome = () => {
    setMessages([]);
    setHasMore(false);
    setOutOfResults(false);
    setLastQuery("");
    setLastTopic(null);
  };

  const startSearch = async (msg, displayAs = null, topicTag = null) => {
    if (!msg.trim() || loading) return;

    setLastQuery(msg.trim());
    setLastTopic(topicTag);
    setOutOfResults(false);
    setHasMore(false);

    const userMsgId = Date.now();
    const userMsg = {
      id: userMsgId,
      role: "user",
      text: displayAs || msg.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    setTimeout(() => {
      const el = userMessageRefs.current[userMsgId];
      const c = threadRef.current;
      if (el && c)
        c.scrollTo({ top: el.offsetTop - c.offsetTop - 8, behavior: "smooth" });
    }, 100);

    try {
      const res = await fetch("/api/declarations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg.trim(),
          shownIds: [],
          topic: topicTag,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unknown error");

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "ai",
          title: displayAs ? `Declarations on ${displayAs}` : "A word for you",
          text: data.response,
          declarations: data.declarations || [],
        },
      ]);

      if (data.declarations && data.declarations.length >= 10) setHasMore(true);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "ai",
          title: "Something went wrong",
          text: "I'm sorry, something went wrong. Please try again in a moment.",
          declarations: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => startSearch(input);

  const handleLoadMore = async () => {
    if (fetchingMore || !lastQuery) return;
    setFetchingMore(true);

    const allIds = messages
      .flatMap((m) => m.declarations || [])
      .map((d) => d.id)
      .filter(Boolean);

    try {
      const res = await fetch("/api/declarations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: lastQuery,
          shownIds: allIds,
          topic: lastTopic,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unknown error");

      if (data.declarations && data.declarations.length > 0) {
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastAiIdx = [...newMessages].reverse().findIndex((m) => m.role === "ai");
          if (lastAiIdx !== -1) {
            const idx = newMessages.length - 1 - lastAiIdx;
            newMessages[idx] = {
              ...newMessages[idx],
              declarations: [
                ...(newMessages[idx].declarations || []),
                ...data.declarations,
              ],
            };
          }
          return newMessages;
        });
        if (data.declarations.length < 10) {
          setHasMore(false);
          setOutOfResults(true);
        }
      } else {
        setHasMore(false);
        setOutOfResults(true);
      }
    } catch (err) {
      console.error("Load more error:", err);
    } finally {
      setFetchingMore(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* The pill composer — the essence of the page. Rendered in-flow at the
     heart of the home screen, and docked at the bottom of the thread. */
  const composer = (placeholder) => (
    <div className="flex items-end gap-1.5 bg-card rounded-[28px] border-[1.5px] border-brand-navy/15 focus-within:border-brand-navy/50 shadow-[0_14px_44px_-20px_rgba(14,36,71,0.5)] p-2 pl-5 transition-colors">
      <Sparkles size={17} style={{ color: GOLD }} className="flex-shrink-0 mb-[13px]" />
      <textarea
        ref={textareaRef}
        rows={1}
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={loading}
        aria-label="Share your situation or need"
        className="flex-1 bg-transparent py-2.5 font-serif text-[16px] text-brand-ink placeholder:text-brand-gray/70 focus:outline-none resize-none min-w-0 max-h-[120px] leading-relaxed"
      />
      <button
        onClick={handleSend}
        disabled={!input.trim() || loading}
        aria-label="Send"
        className="w-[46px] h-[46px] rounded-full bg-brand-navy text-white flex items-center justify-center flex-shrink-0 hover:bg-brand-deep hover:-translate-y-px transition-all disabled:opacity-40 disabled:hover:translate-y-0"
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Send size={15} />
        )}
      </button>
    </div>
  );

  return (
    <main className="h-dvh bg-background flex flex-col">
      {/* Header */}
      <header
        className="flex items-center gap-3.5 px-4 sm:px-6 py-3 flex-shrink-0 backdrop-blur-md bg-gradient-to-b from-brand-sky/55 to-card/90"
        style={{
          borderBottom: "1px solid rgba(184,134,47,0.22)",
        }}
      >
        <button
          type="button"
          onClick={() => (hasSearched ? goHome() : router.push("/"))}
          aria-label={hasSearched ? "Back to declarations home" : "Back to home"}
          className="w-10 h-10 rounded-full border border-brand-navy/15 bg-card text-brand-navy flex items-center justify-center shadow-sm hover:-translate-x-0.5 transition-transform flex-shrink-0"
          style={{ transitionDuration: "150ms" }}
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="w-[34px] h-[34px] rounded-[10px] flex-shrink-0 font-serif text-[19px] leading-none flex items-center justify-center"
            style={{
              background: "linear-gradient(150deg, #173A68, #102A4E)",
              color: GOLD_ON_NAVY,
              boxShadow: "inset 0 0 0 1px rgba(201,162,39,0.35)",
            }}
          >
            &rdquo;
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-brand-ink leading-tight tracking-tight">
              Faith Declarations
            </h1>
            <p className="flex items-center gap-1.5 text-[11.5px] text-brand-gray">
              <span className="w-3.5 h-px opacity-70" style={{ background: GOLD }} />
              Speak God&rsquo;s Word over your life
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {streak >= 2 && (
            <span
              title="Days you've come to declare the Word"
              className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-bold"
              style={{
                color: GOLD,
                background: "linear-gradient(150deg, rgba(184,134,47,0.16), rgba(184,134,47,0.05))",
                borderColor: "rgba(184,134,47,0.40)",
                boxShadow: "0 2px 12px -6px rgba(184,134,47,0.55)",
              }}
            >
              <Flame size={12} />
              <span className="font-serif text-[15px] tabular-nums">{streak}</span>
              -day streak
            </span>
          )}
          <ThemeToggle className="w-9 h-9 flex items-center justify-center rounded-full text-brand-gray hover:text-brand-navy hover:bg-brand-sky transition-colors" />
        </div>
      </header>

      {/* Theme chips — only in the thread view */}
      {hasSearched && (
        <div className="flex-shrink-0 border-b border-brand-navy/10 bg-card/90 backdrop-blur-md">
          <div className="max-w-3xl mx-auto flex items-center gap-1.5 px-4 sm:px-6 py-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gray mr-2 whitespace-nowrap">
              Themes
            </span>
            {TOPICS.map(({ name }) => {
              const active = lastTopic === name.toLowerCase();
              return (
                <button
                  key={name}
                  onClick={() => handleTopicClick(name)}
                  className={`flex-shrink-0 inline-flex items-center gap-2 rounded-full px-[17px] py-2 text-[13px] font-semibold transition-all ${
                    active
                      ? "text-white -translate-y-px"
                      : "text-brand-gray border border-transparent hover:text-brand-ink hover:bg-brand-sky/70 hover:border-brand-navy/10"
                  }`}
                  style={
                    active
                      ? {
                          background: "linear-gradient(150deg, #173A68, #102A4E)",
                          boxShadow:
                            "inset 0 0 0 1px rgba(201,162,39,0.4), 0 6px 18px -8px rgba(14,36,71,0.55)",
                        }
                      : undefined
                  }
                >
                  <span
                    className={`w-[5px] h-[5px] rounded-full transition-transform ${
                      active ? "scale-100" : "scale-0"
                    }`}
                    style={{ background: GOLD_ON_NAVY }}
                  />
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Scrollable stage */}
      <div
        ref={threadRef}
        className="flex-1 min-h-0 overflow-y-auto custom-scrollbar"
        aria-live="polite"
      >
        {!hasSearched ? (
          /* ══ Screen 1 · Home ══ */
          <div className="max-w-[980px] mx-auto px-4 sm:px-6 py-6 sm:py-9">
            {/* Today's declaration */}
            {featured ? (
              <div className="relative overflow-hidden rounded-3xl p-7 sm:p-12 text-white shadow-xl shadow-brand-navy/20 bg-[linear-gradient(160deg,#173A68_0%,#102A4E_100%)]">
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(900px 380px at 88% -20%, rgba(234,242,251,0.10), transparent 60%), radial-gradient(600px 320px at -5% 115%, rgba(201,162,39,0.14), transparent 55%)",
                  }}
                />
                <Quote
                  size={210}
                  strokeWidth={0}
                  fill="currentColor"
                  className="absolute -top-10 -right-2 text-white/[0.07] pointer-events-none"
                />
                <p
                  className="relative flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.22em]"
                  style={{ color: GOLD_ON_NAVY }}
                >
                  <span className="w-[26px] h-px" style={{ background: GOLD_ON_NAVY }} />
                  Today&rsquo;s Declaration · {todayLabel}
                </p>
                <blockquote className="relative mt-4.5 font-serif font-medium leading-[1.18] tracking-tight text-balance max-w-[24ch] text-[26px] sm:text-[42px] mt-5">
                  &ldquo;{featured.declaration_text}&rdquo;
                </blockquote>
                <div className="relative mt-7 flex items-center gap-3.5 flex-wrap">
                  {featured.sermon_title && (
                    <span className="text-[13px] text-white/70 mr-auto">
                      Spoken by Rev. Peter in{" "}
                      <span className="font-semibold text-white">
                        {cleanTitle(featured.sermon_title)}
                      </span>
                    </span>
                  )}
                  <button
                    onClick={() => copyDeclaration(featured.declaration_text)}
                    title="Copy"
                    aria-label="Copy today's declaration"
                    className="w-[38px] h-[38px] rounded-full border border-white/35 text-white flex items-center justify-center hover:border-white/80 transition-colors flex-shrink-0"
                  >
                    <Copy size={13} />
                  </button>
                  {(() => {
                    const parsed = parseYoutubeUrl(featured.youtube_url_with_timestamp);
                    if (!parsed) return null;
                    return (
                      <button
                        type="button"
                        onClick={() =>
                          setWatching({ ...parsed, sermon_title: featured.sermon_title })
                        }
                        className="inline-flex items-center gap-2 rounded-full border border-white/35 px-5 py-2.5 text-[13.5px] font-semibold text-white hover:border-white/80 hover:-translate-y-px transition-all"
                      >
                        <Play size={11} fill="currentColor" />
                        Watch the moment
                      </button>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl bg-brand-sky/70 border border-brand-navy/10 px-7 py-12 text-center">
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-card border border-brand-navy/10 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-navy">
                  <Quote size={12} />
                  Declarations
                </span>
                <h2 className="mt-4 text-2xl sm:text-3xl font-bold text-brand-ink tracking-tight">
                  Speak the Word over your life.
                </h2>
              </div>
            )}

            {/* The ask box — the essence of the page */}
            <div className="mt-10 mx-auto max-w-[760px] text-center">
              <h2 className="font-serif text-[22px] sm:text-[30px] font-medium tracking-tight text-brand-ink text-balance mb-5">
                What do you need the Word for today?
              </h2>
              {composer("Tell us what's on your heart…")}

              {/* Theme suggestions */}
              <div className="mt-7 flex flex-wrap justify-center gap-2.5 max-w-[860px] mx-auto">
                {TOPICS.map(({ name, sub }) => (
                  <button
                    key={name}
                    onClick={() => handleTopicClick(name)}
                    className="inline-flex items-baseline gap-2 rounded-full border border-brand-navy/12 bg-card px-[18px] py-2.5 hover:-translate-y-px transition-all"
                    style={{ transitionDuration: "160ms" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = GOLD;
                      e.currentTarget.style.background = "rgba(184,134,47,0.06)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "";
                      e.currentTarget.style.background = "";
                    }}
                  >
                    <span className="font-serif text-[15px] font-semibold text-brand-ink">
                      {name}
                    </span>
                    <span className="hidden sm:inline text-[12px] text-brand-gray">{sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-9 text-center text-[12px] text-brand-gray">
              Every declaration was spoken by Rev. Peter in a real message — watch the
              moment behind each one.
            </p>
          </div>
        ) : (
          /* ══ Screen 2 · Thread ══ */
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-7">
            {messages.map((msg, mIdx) => {
              if (msg.role === "user") {
                return (
                  <div
                    key={msg.id}
                    ref={(el) => {
                      userMessageRefs.current[msg.id] = el;
                    }}
                    className="flex justify-end mt-8 first:mt-0 mb-5"
                  >
                    <p className="font-serif text-[15px] text-white bg-brand-navy rounded-[20px] rounded-br-[4px] px-5 py-3 max-w-[75%] capitalize">
                      {msg.text}
                    </p>
                  </div>
                );
              }

              const isLastAi =
                mIdx === messages.length - 1 ||
                !messages.slice(mIdx + 1).some((m) => m.role === "ai");

              return (
                <article
                  key={msg.id}
                  className="rounded-[22px] border border-brand-navy/10 bg-card overflow-hidden shadow-sm shadow-brand-navy/5 animate-in fade-in slide-in-from-bottom-3 duration-500"
                >
                  {/* Response head */}
                  <div className="px-5 sm:px-7 pt-6 pb-5 border-b border-brand-navy/[0.07] bg-gradient-to-b from-brand-sky/70 to-transparent">
                    <p
                      className="text-[11px] font-bold uppercase tracking-[0.22em]"
                      style={{ color: GOLD }}
                    >
                      You asked for
                    </p>
                    <h2 className="mt-2 font-serif text-[24px] sm:text-[32px] font-medium tracking-tight text-brand-ink leading-tight">
                      {msg.title}
                    </h2>
                    {msg.text && (
                      <p className="mt-2.5 text-[14.5px] leading-[1.65] text-brand-gray max-w-[62ch] whitespace-pre-wrap">
                        {msg.text}
                      </p>
                    )}
                  </div>

                  {msg.declarations?.length > 0 && (
                    <>
                      {/* Tools row */}
                      <div className="flex items-center justify-between gap-3.5 flex-wrap px-5 sm:px-7 py-3.5 border-b border-brand-navy/[0.07]">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gray">
                          Speak these over your life ·{" "}
                          <span className="text-brand-ink">{msg.declarations.length}</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => setSpeakMsgId(msg.id)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-brand-navy text-white text-[13px] font-semibold px-5 py-2.5 hover:bg-brand-deep hover:-translate-y-px transition-all shadow-sm shadow-brand-navy/20"
                        >
                          <Play size={11} fill="currentColor" />
                          Speak mode
                        </button>
                      </div>

                      {/* Litany lines */}
                      <div className="divide-y divide-brand-navy/[0.07]">
                        {msg.declarations.map((d, i) => (
                          <DeclarationRow
                            key={d.id || i}
                            declaration={d}
                            index={i}
                            onCopy={copyDeclaration}
                            onWatch={setWatching}
                          />
                        ))}
                      </div>

                      {/* More declarations — inside the card, on the latest response */}
                      {isLastAi && !loading && (hasMore || outOfResults) && (
                        <div className="border-t border-brand-navy/[0.07] px-5 sm:px-7 py-5 text-center">
                          {hasMore ? (
                            <button
                              onClick={handleLoadMore}
                              disabled={fetchingMore}
                              className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-brand-navy text-brand-navy text-[13.5px] font-semibold px-6 py-2.5 hover:bg-brand-navy hover:text-white transition-colors disabled:opacity-60"
                            >
                              {fetchingMore ? (
                                <Loader2 size={15} className="animate-spin" />
                              ) : (
                                <>More declarations →</>
                              )}
                            </button>
                          ) : (
                            <p className="text-[13px] text-brand-gray max-w-xs mx-auto leading-relaxed">
                              You&rsquo;ve seen every declaration for this need. Try asking
                              about something else on your heart.
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </article>
              );
            })}

            {/* Searching state */}
            {loading && (
              <div className="mt-6 flex items-center gap-3 text-brand-gray">
                <span className="flex gap-1">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="w-2 h-2 rounded-full bg-brand-navy/40 animate-pulse"
                      style={{ animationDelay: `${d * 150}ms` }}
                    />
                  ))}
                </span>
                <span className="text-sm font-medium">Finding the Word for you…</span>
              </div>
            )}

            <p className="mt-6 text-center text-[12px] text-brand-gray">
              Every declaration was spoken by Rev. Peter in a real message — watch the
              moment behind each one.
            </p>
          </div>
        )}
      </div>

      {/* Docked composer — thread view only; home has it in-flow */}
      {hasSearched && (
        <div className="flex-shrink-0 px-4 sm:px-6 pt-2 pb-4 bg-gradient-to-t from-background via-background/95 to-transparent">
          <div className="max-w-[760px] mx-auto">
            {composer("Ask for more, or something else on your heart…")}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-brand-ink text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {(() => {
        const speakMsg = messages.find((m) => m.id === speakMsgId);
        if (!speakMsg?.declarations?.length) return null;
        const lastAi = [...messages].reverse().find((m) => m.role === "ai");
        return (
          <SpeakMode
            items={speakMsg.declarations}
            canLoadMore={lastAi?.id === speakMsgId && hasMore}
            loadingMore={fetchingMore}
            onLoadMore={handleLoadMore}
            onClose={() => setSpeakMsgId(null)}
            onCopy={copyDeclaration}
            onWatch={(seg) => {
              setSpeakMsgId(null);
              setWatching(seg);
            }}
          />
        );
      })()}

      <VideoModal seg={watching} onClose={() => setWatching(null)} />
    </main>
  );
}
