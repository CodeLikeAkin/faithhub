"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Send,
  Play,
  Loader2,
  Copy,
  Quote,
  Flame,
  Sprout,
  HeartPulse,
  TrendingUp,
  ShieldCheck,
  Compass,
  Heart,
  Mountain,
  Sunrise,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cleanTitle } from "@/lib/titles";
import { parseYoutubeUrl } from "@/lib/youtube";
import VideoModal from "@/components/VideoModal";

/**
 * Faith Declarations — a devotional surface, not a chatbot. The landing leads
 * with Today's declaration (same day-of-year rotation as DeclarationOfTheDay)
 * and a grid of themes, so the screen is devotional from the first second. A
 * believer picks a theme or shares a need; Rev. Peter's own declarations come
 * back as large, speakable proclamation cards, each grounded in the message it
 * was preached in with the moment to watch. Same study-workspace grammar as
 * /ask and the series studio.
 */

const TOPICS = [
  { name: "Faith", sub: "When you need to believe again", Icon: Sprout },
  { name: "Healing", sub: "Health & wholeness", Icon: HeartPulse },
  { name: "Finances", sub: "Provision & increase", Icon: TrendingUp },
  { name: "Fear", sub: "Peace over anxiety", Icon: ShieldCheck },
  { name: "Purpose", sub: "Direction & calling", Icon: Compass },
  { name: "Relationships", sub: "Family & connection", Icon: Heart },
  { name: "Strength", sub: "When you are weary", Icon: Mountain },
  { name: "Mindset", sub: "Renewing the mind", Icon: Sunrise },
];

const STREAK_KEY = "hof-decl-streak";
const localDay = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function DeclarationCard({ declaration, index, onCopy, onWatch }) {
  const parsed = parseYoutubeUrl(declaration.youtube_url_with_timestamp);
  return (
    <div
      className="relative rounded-2xl border border-brand-navy/10 bg-white px-6 sm:px-7 pt-6 pb-4 shadow-sm shadow-brand-navy/5 hover:border-brand-navy/30 hover:shadow-lg hover:shadow-brand-navy/10 transition-all animate-in fade-in slide-in-from-bottom-2 duration-500"
      style={{ animationDelay: `${Math.min(index, 8) * 70}ms`, animationFillMode: "backwards" }}
    >
      <span className="absolute -top-3 left-6 w-8 h-8 rounded-xl bg-brand-navy text-white text-sm font-bold flex items-center justify-center shadow-sm shadow-brand-navy/20">
        {index + 1}
      </span>
      <Quote
        size={30}
        className="absolute top-5 right-5 text-brand-mist/70"
        fill="currentColor"
        strokeWidth={0}
      />
      <blockquote className="mt-1 text-lg sm:text-xl leading-[1.5] font-medium text-brand-ink max-w-[46ch]">
        {declaration.declaration_text}
      </blockquote>
      <div className="mt-4 pt-3.5 border-t border-brand-navy/10 flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1.5 min-w-0 text-[11.5px] text-brand-gray">
          <Play size={10} className="text-brand-navy/50 flex-shrink-0" fill="currentColor" />
          <span className="truncate max-w-[240px]">
            <span className="font-semibold text-brand-ink">
              {cleanTitle(declaration.sermon_title)}
            </span>
          </span>
        </span>
        <span className="ml-auto flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onCopy(declaration.declaration_text)}
            title="Copy this declaration"
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-navy/12 bg-white px-3 py-1.5 text-[11px] font-bold text-brand-gray hover:text-brand-navy hover:border-brand-navy/40 transition-colors"
          >
            <Copy size={11} />
            Copy
          </button>
          {parsed && (
            <button
              type="button"
              onClick={() =>
                onWatch({ ...parsed, sermon_title: declaration.sermon_title })
              }
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-navy/25 bg-brand-navy/5 px-3 py-1.5 text-[11px] font-bold text-brand-navy hover:bg-brand-navy hover:text-white transition-colors"
            >
              <Play size={10} fill="currentColor" />
              Watch moment
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

export default function DeclarationsPage() {
  const [messages, setMessages] = useState([]); // { id, role, text, declarations }
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTopic, setActiveTopic] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [outOfResults, setOutOfResults] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [toast, setToast] = useState(null);
  const [featured, setFeatured] = useState(null); // today's declaration
  const [streak, setStreak] = useState(0);
  const [watching, setWatching] = useState(null); // segment currently open in the video modal
  const textareaRef = useRef(null);
  const threadRef = useRef(null);
  const userMessageRefs = useRef({});
  const toastTimer = useRef(null);

  const hasSearched = messages.length > 0;

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
  }, [input]);

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
    setActiveTopic(topic);
    startSearch(`I need declarations about ${topic.toLowerCase()}`, topic);
  };

  const startSearch = async (msg, displayAs = null) => {
    if (!msg.trim() || loading) return;

    setLastQuery(msg.trim());
    setOutOfResults(false);
    setHasMore(false);

    const userMsgId = Date.now();
    const userMsg = {
      id: userMsgId,
      role: "user",
      text: displayAs ? `Declarations on ${displayAs.toLowerCase()}` : msg.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setActiveTopic(null);
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
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unknown error");

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "ai",
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

  return (
    <main className="h-dvh bg-white flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-brand-navy/10 bg-white flex-shrink-0">
        <Link
          href="/"
          aria-label="Back to home"
          className="w-10 h-10 rounded-xl border border-brand-navy/15 bg-white text-brand-navy flex items-center justify-center hover:bg-brand-sky transition-colors flex-shrink-0"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-brand-ink leading-tight">
            Faith Declarations
          </h1>
          <p className="text-[11.5px] text-brand-gray">
            Speak God&rsquo;s Word over your life
          </p>
        </div>
        {streak >= 2 && (
          <span
            title="Days you've come to declare the Word"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-bold flex-shrink-0"
            style={{
              color: "#B8862F",
              background: "rgba(184,134,47,0.10)",
              borderColor: "rgba(184,134,47,0.30)",
            }}
          >
            <Flame size={12} />
            {streak}-day streak
          </span>
        )}
      </header>

      {/* Compact topic switcher — only once a search is on screen */}
      {hasSearched && (
        <div className="flex gap-2 px-4 sm:px-6 py-2.5 overflow-x-auto flex-shrink-0 border-b border-brand-navy/5 bg-brand-light/60 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TOPICS.map(({ name }) => (
            <button
              key={name}
              onClick={() => handleTopicClick(name)}
              className="flex-shrink-0 rounded-full border border-brand-navy/15 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-brand-navy hover:bg-brand-sky hover:border-brand-navy/30 transition-colors"
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Thread */}
      <div
        ref={threadRef}
        className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative"
        aria-live="polite"
      >
        {!hasSearched ? (
          /* Devotional landing */
          <div className="relative">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[340px] bg-gradient-to-b from-brand-sky to-transparent" />
            <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
              {/* Today's declaration */}
              {featured ? (
                <div className="relative overflow-hidden rounded-[1.75rem] p-7 sm:p-9 text-white shadow-xl shadow-brand-navy/20 bg-[linear-gradient(122deg,#102A4E_0%,#173A68_62%,#24487D_100%)]">
                  <Quote
                    size={200}
                    strokeWidth={0}
                    fill="currentColor"
                    className="absolute -top-8 -right-4 text-white/[0.06] pointer-events-none"
                  />
                  <p className="relative inline-flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/75">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D9A93E]" />
                    Today&rsquo;s declaration
                  </p>
                  <blockquote className="relative mt-4 text-2xl sm:text-[32px] font-medium leading-[1.3] max-w-[20ch] tracking-tight">
                    &ldquo;{featured.declaration_text}&rdquo;
                  </blockquote>
                  <div className="relative mt-6 flex items-center gap-3 flex-wrap">
                    {featured.sermon_title && (
                      <span className="text-[12.5px] text-white/80">
                        From{" "}
                        <span className="font-semibold text-white">
                          {cleanTitle(featured.sermon_title)}
                        </span>
                      </span>
                    )}
                    <span className="sm:ml-auto flex items-center gap-2">
                      <button
                        onClick={() => copyDeclaration(featured.declaration_text)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white/12 border border-white/25 px-3.5 py-2 text-[12px] font-bold text-white hover:bg-white/20 transition-colors"
                      >
                        <Copy size={12} />
                        Copy
                      </button>
                      {(() => {
                        const parsed = parseYoutubeUrl(
                          featured.youtube_url_with_timestamp
                        );
                        if (!parsed) return null;
                        return (
                          <button
                            type="button"
                            onClick={() =>
                              setWatching({
                                ...parsed,
                                sermon_title: featured.sermon_title,
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-full bg-white text-brand-navy px-3.5 py-2 text-[12px] font-bold hover:bg-brand-sky transition-colors"
                          >
                            <Play size={11} fill="currentColor" />
                            Watch the moment
                          </button>
                        );
                      })()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-[1.75rem] bg-brand-sky/70 border border-brand-navy/10 px-7 py-12 text-center">
                  <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-brand-navy/10 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-navy">
                    <Quote size={12} />
                    Declarations
                  </span>
                  <h2 className="mt-4 text-2xl sm:text-3xl font-bold text-brand-ink tracking-tight">
                    Speak the Word over your life.
                  </h2>
                </div>
              )}

              {/* Topic grid */}
              <div className="mt-8 flex items-baseline justify-between gap-3">
                <h3 className="text-lg sm:text-xl font-bold text-brand-ink tracking-tight">
                  What do you need the Word for today?
                </h3>
                <span className="hidden sm:block text-[12.5px] text-brand-gray">
                  Pick a theme, or ask below
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                {TOPICS.map(({ name, sub, Icon }) => (
                  <button
                    key={name}
                    onClick={() => handleTopicClick(name)}
                    className="group text-left rounded-2xl border border-brand-navy/10 bg-white p-4 hover:-translate-y-0.5 hover:border-brand-navy/40 hover:shadow-md hover:shadow-brand-navy/10 transition-all"
                  >
                    <span className="w-10 h-10 rounded-xl bg-brand-sky text-brand-navy flex items-center justify-center mb-3 group-hover:bg-brand-navy group-hover:text-white transition-colors">
                      <Icon size={18} />
                    </span>
                    <span className="block text-[14.5px] font-bold text-brand-ink">
                      {name}
                    </span>
                    <span className="block text-[11.5px] text-brand-gray mt-0.5 leading-snug">
                      {sub}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
            {messages.map((msg) => {
              if (msg.role === "user") {
                return (
                  <div
                    key={msg.id}
                    ref={(el) => {
                      userMessageRefs.current[msg.id] = el;
                    }}
                    className="mt-8 first:mt-0"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-navy/60 mb-1.5">
                      You asked for
                    </p>
                    <h3 className="text-lg sm:text-2xl font-bold text-brand-ink tracking-tight leading-snug capitalize">
                      {msg.text}
                    </h3>
                  </div>
                );
              }

              return (
                <div key={msg.id} className="mt-4">
                  {msg.text && (
                    <p className="text-[14.5px] leading-relaxed text-brand-ink/85 mb-5 whitespace-pre-wrap max-w-[62ch]">
                      {msg.text}
                    </p>
                  )}
                  {msg.declarations?.length > 0 && (
                    <>
                      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-navy mb-4">
                        <Quote size={12} />
                        Speak these over your life · {msg.declarations.length}
                      </p>
                      <div className="flex flex-col gap-3.5">
                        {msg.declarations.map((d, i) => (
                          <DeclarationCard
                            key={d.id || i}
                            declaration={d}
                            index={i}
                            onCopy={copyDeclaration}
                            onWatch={setWatching}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {/* Load more */}
            {!loading && hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={fetchingMore}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-navy text-white text-[13px] font-bold px-6 py-3 hover:bg-brand-deep transition-colors disabled:opacity-60"
                >
                  {fetchingMore ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <>More declarations →</>
                  )}
                </button>
              </div>
            )}

            {!loading && outOfResults && (
              <p className="mt-6 text-center text-[13px] text-brand-gray max-w-xs mx-auto leading-relaxed">
                You&rsquo;ve seen every declaration for this need. Try asking
                about something else on your heart.
              </p>
            )}

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
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 border-t border-brand-navy/10 bg-white px-4 sm:px-6 pt-3 pb-3.5">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 bg-brand-light rounded-2xl border border-brand-navy/15 focus-within:border-brand-navy/40 shadow-sm p-1.5 pl-4 transition-colors">
            <Sparkles size={17} className="text-brand-navy/50 flex-shrink-0 mb-2.5" />
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Or tell us what's on your heart…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              aria-label="Share your situation or need"
              className="flex-1 bg-transparent py-2 text-[15px] text-brand-ink placeholder:text-brand-gray/60 focus:outline-none resize-none min-w-0 max-h-[120px] leading-relaxed"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              aria-label="Send"
              className="w-10 h-10 rounded-xl bg-brand-navy text-white flex items-center justify-center flex-shrink-0 hover:bg-brand-deep transition-colors disabled:opacity-40"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-brand-gray">
            Every declaration was spoken by Rev. Peter in a real message — watch
            the moment behind each one.
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-brand-ink text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      <VideoModal seg={watching} onClose={() => setWatching(null)} />
    </main>
  );
}
