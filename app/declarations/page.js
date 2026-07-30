"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
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
  Check,
  Volume2,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cleanTitle } from "@/lib/titles";
import { parseYoutubeUrl } from "@/lib/youtube";
import { useKeyboardInset } from "@/lib/useKeyboardInset";
import VideoModal from "@/components/VideoModal";
import NavHamburger from "@/components/NavHamburger";

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
function DeclarationRow({ declaration, index, onCopy, onWatch, selectMode, picked, onTogglePick }) {
  const parsed = parseYoutubeUrl(declaration.youtube_url_with_timestamp);
  return (
    <div
      className="flex items-start gap-3 px-5 sm:px-7 py-3 animate-in fade-in duration-500"
      style={{ animationDelay: `${Math.min(index, 10) * 55}ms`, animationFillMode: "backwards" }}
    >
      {selectMode ? (
        <button
          type="button"
          onClick={() => onTogglePick(declaration)}
          aria-label={picked ? "Remove from selection" : "Add to selection"}
          aria-pressed={picked}
          className={`w-5 h-5 rounded-md border-[1.5px] flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
            picked
              ? "bg-brand-navy border-brand-navy text-white"
              : "border-brand-navy/25 text-transparent hover:border-brand-navy/50"
          }`}
        >
          <Check size={11} strokeWidth={3} />
        </button>
      ) : (
        <span className="font-serif text-sm tabular-nums w-5 text-center flex-shrink-0 pt-0.5 text-brand-navy/35">
          {index + 1}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <blockquote className="font-serif text-sm sm:text-base leading-[1.35] text-brand-ink max-w-[46ch]">
          {declaration.declaration_text}
        </blockquote>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onCopy(declaration.declaration_text)}
          title="Copy this declaration"
          aria-label="Copy this declaration"
          className="relative w-9 h-9 rounded-full text-brand-gray flex items-center justify-center hover:bg-brand-sky hover:text-brand-navy transition-colors before:content-[''] before:absolute before:-inset-1"
        >
          <Copy size={12} />
        </button>
        {parsed && (
          <button
            type="button"
            onClick={() => onWatch({ ...parsed, sermon_title: declaration.sermon_title })}
            title="Watch this moment"
            aria-label="Watch this moment"
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-brand-ink bg-white border border-brand-navy/15 hover:bg-brand-sky hover:border-brand-navy/40 transition-colors before:content-[''] before:absolute before:-inset-1"
          >
            <Play size={12} style={{ color: GOLD }} fill="currentColor" className="ml-0.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The one control that turns select mode on/off — a checkbox, not a button,
 * so it reads as a state toggle rather than an action. Reused near the Themes
 * row and inside each card's tools row; both instances drive the same global
 * select-mode state on DeclarationsPage.
 */
function SelectToggle({ on, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={on ? "Stop selecting declarations" : "Select declarations"}
      aria-label={on ? "Stop selecting declarations" : "Select declarations"}
      className={`flex-shrink-0 w-11 h-11 flex items-center justify-center ${className}`}
    >
      <span
        className={`w-5 h-5 rounded-md border-[1.5px] flex items-center justify-center transition-colors ${
          on
            ? "bg-brand-navy border-brand-navy text-white"
            : "border-brand-navy/30 text-transparent"
        }`}
      >
        <Check size={11} strokeWidth={3} />
      </span>
    </button>
  );
}

/**
 * Turns tag-clicking from "pick one" into "add another" — off by default, so a
 * plain tap always replaces the active theme rather than piling chips up. Kept
 * visually distinct from SelectToggle (which drives declaration-picking) since
 * the two controls are unrelated.
 */
function MultiTagToggle({ on, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={on ? "Adding themes — tap to go back to one at a time" : "Select more than one theme at once"}
      aria-label={on ? "Adding themes — tap to go back to one at a time" : "Select more than one theme at once"}
      className={`flex-shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 h-7 text-[11px] font-bold uppercase tracking-wide transition-colors ${
        on
          ? "bg-brand-navy text-white"
          : "text-brand-gray border border-brand-navy/20 hover:text-brand-ink hover:bg-white"
      } ${className}`}
    >
      <Plus size={10} strokeWidth={3} />
      Multi
    </button>
  );
}

/**
 * Speak mode — a full-screen focus view for proclaiming declarations one at a
 * time, distraction-free. Arrow keys / on-screen arrows move between them; the
 * source and a "Watch the moment" affordance stay within reach.
 */
const SPEAK_SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function SpeakMode({ items, onClose, onCopy, onWatch, canLoadMore, loadingMore, onLoadMore }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1); // 1 → 1x, the default pace
  const speed = SPEAK_SPEEDS[speedIdx];
  const move = (n) => setI((p) => (p + n + items.length) % items.length);
  const cycleSpeed = () => setSpeedIdx((p) => (p + 1) % SPEAK_SPEEDS.length);

  // Lock body scroll while the full-screen view is open (same pattern as
  // VideoModal / StudyWorkspace) so the page behind doesn't scroll on touch.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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
  // reading-aloud pace (longer lines get more time), scaled by the chosen
  // speed. The timer restarts on any manual navigation or speed change so a
  // skip (or a speed tap) doesn't get cut short or leave a stale timer running.
  useEffect(() => {
    if (!playing) return;
    const secs = Math.min(16, Math.max(7, items[i].declaration_text.length / 14)) / speed;
    const t = setTimeout(() => move(1), secs * 1000);
    return () => clearTimeout(t);
  }, [playing, i, items, speed]);

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
        <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: GOLD_ON_NAVY }}>
          Speak mode
        </span>
        <span className="text-xs font-semibold text-white/40 tabular-nums">
          {i + 1} / {items.length}
        </span>
        <button
          onClick={cycleSpeed}
          title="Playback speed — tap to change"
          aria-label={`Playback speed ${speed}x, tap to change`}
          className="ml-auto h-11 px-3.5 rounded-xl border border-white/20 bg-white/5 text-white text-xs font-bold tabular-nums flex items-center justify-center hover:bg-white/15 transition-colors"
        >
          {speed}x
        </button>
        <button
          onClick={onClose}
          aria-label="Close speak mode"
          className="w-11 h-11 rounded-xl border border-white/20 bg-white/5 text-white flex items-center justify-center hover:bg-white/15 transition-colors"
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
            <p className="mt-7 text-sm text-white/60">
              From{" "}
              <span className="font-semibold text-white/85">
                {cleanTitle(d.sermon_title)}
              </span>
            </p>
          )}
          <div className="mt-6 flex items-center justify-center gap-2.5 flex-wrap">
            <button
              onClick={() => onCopy(d.declaration_text)}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/25 px-4 py-2 text-xs font-bold text-white hover:bg-white/20 transition-colors"
            >
              <Copy size={12} />
              Copy
            </button>
            {parsed && (
              <button
                onClick={() => onWatch({ ...parsed, sermon_title: d.sermon_title })}
                className="inline-flex items-center gap-1.5 rounded-full bg-white text-brand-navy px-4 py-2 text-xs font-bold hover:bg-brand-sky transition-colors"
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
                className="h-[7px] rounded-full transition-[width,background-color]"
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
              className="h-full rounded-full transition-[width] duration-500"
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
              className="inline-flex items-center gap-1.5 h-12 rounded-full border border-white/25 bg-white/5 px-4 text-sm font-bold text-white hover:bg-white/15 transition-colors disabled:opacity-60"
            >
              {loadingMore ? (
                <Loader2 size={14} className="motion-safe:animate-spin" />
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
  const [activeTopics, setActiveTopics] = useState(new Set()); // chips currently on, lowercase
  const [lastTopics, setLastTopics] = useState([]); // topics behind the on-screen card, for "load more"
  const [topicCardId, setTopicCardId] = useState(null); // AI message that topic chips update in place
  const [topicUserMsgId, setTopicUserMsgId] = useState(null); // its paired "Declarations on X" bubble, kept in sync
  const [toast, setToast] = useState(null);
  const [featured, setFeatured] = useState(null); // today's declaration
  const [streak, setStreak] = useState(0);
  const [watching, setWatching] = useState(null); // segment currently open in the video modal
  const [speakMsgId, setSpeakMsgId] = useState(null); // AI message whose declarations are open in speak mode (live — grows with +10)
  const [speakFromCart, setSpeakFromCart] = useState(false); // speak mode opened from the picked-declarations cart instead
  const [selectMode, setSelectMode] = useState(false); // checkbox picking, on/off across the whole thread
  const [multiTagMode, setMultiTagMode] = useState(false); // off = tapping a theme replaces it; on = taps add/remove
  const [picked, setPicked] = useState(new Map()); // id -> declaration, the cross-topic cart
  const [cartOpen, setCartOpen] = useState(false); // preview panel listing what's in the cart
  const textareaRef = useRef(null);
  const threadRef = useRef(null);
  const mobileThemesRef = useRef(null); // the one-line scrolling themes row
  const userMessageRefs = useRef({});
  const toastTimer = useRef(null);
  const keyboardInset = useKeyboardInset();

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

  // Topic chips are a live filter, not a chat message — tapping a second or
  // third chip re-mixes the same on-screen card across all active tags rather
  // than piling up a new user bubble per tap (see match_declarations_by_topic).
  // Leaving select mode clears the cart — select mode off means nothing is
  // selected, so the floating "Speak these" pill never lingers after you're
  // done picking.
  const toggleSelectMode = () => {
    setSelectMode((v) => {
      const next = !v;
      if (!next) {
        setPicked(new Map());
        setCartOpen(false);
      }
      return next;
    });
  };

  const togglePick = (declaration) => {
    const key = declaration.id || declaration.declaration_text;
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, declaration);
      return next;
    });
  };

  const handleTopicClick = (topicName) => {
    const t = topicName.toLowerCase();
    if (multiTagMode) {
      // Multi mode just builds up the selection — tapping a tag toggles its
      // highlight but does NOT search yet. The user confirms with the arrow
      // once they've picked every theme they want mixed together.
      const next = new Set(activeTopics);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      if (next.size === 0) next.add(t); // always leave at least one chip active
      setActiveTopics(next);
      return;
    }
    // Plain tap replaces the selection outright and searches immediately.
    const next = new Set([t]);
    setActiveTopics(next);
    runTopicSearch(Array.from(next));
  };

  const applyMultiTagSelection = () => runTopicSearch(Array.from(activeTopics));

  const toggleMultiTagMode = () => setMultiTagMode((v) => !v);

  // The themes row scrolls sideways now, so the active theme can sit offscreen
  // — bring it back into view whenever the selection changes.
  useEffect(() => {
    const row = mobileThemesRef.current;
    const chip = row?.querySelector('[data-active="true"]');
    chip?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeTopics]);

  const goHome = () => {
    setMessages([]);
    setHasMore(false);
    setOutOfResults(false);
    setLastQuery("");
    setActiveTopics(new Set());
    setLastTopics([]);
    setTopicCardId(null);
    setTopicUserMsgId(null);
    setSelectMode(false);
    setMultiTagMode(false);
    setPicked(new Map());
    setCartOpen(false);
  };

  const runTopicSearch = async (topics) => {
    if (!topics.length || loading) return;

    setLastQuery(`declarations about ${topics.join(" and ")}`);
    setLastTopics(topics);
    setOutOfResults(false);
    setHasMore(false);
    setLoading(true);

    const displayAs = topics
      .map((t) => t[0].toUpperCase() + t.slice(1))
      .join(" + ");

    // Only the first tap creates a user bubble; later taps update that same
    // AI card in place so switching chips reads as filtering, not re-asking.
    const reuseCard = topicCardId !== null;
    let userMsgId = null;
    if (!reuseCard) {
      userMsgId = Date.now();
      setTopicUserMsgId(userMsgId);
      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", text: `Declarations on ${displayAs}` },
      ]);
      setTimeout(() => {
        const el = userMessageRefs.current[userMsgId];
        const c = threadRef.current;
        if (el && c)
          c.scrollTo({ top: el.offsetTop - c.offsetTop - 8, behavior: "smooth" });
      }, 100);
    }

    try {
      const res = await fetch("/api/declarations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `declarations about ${topics.join(" and ")}`,
          shownIds: [],
          topics,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unknown error");

      const cardTitle = `Declarations on ${displayAs}`;
      if (reuseCard) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === topicCardId)
              return { ...m, title: cardTitle, text: data.response, declarations: data.declarations || [] };
            if (m.id === topicUserMsgId) return { ...m, text: `Declarations on ${displayAs}` };
            return m;
          })
        );
      } else {
        const aiMsgId = Date.now() + 1;
        setMessages((prev) => [
          ...prev,
          {
            id: aiMsgId,
            role: "ai",
            title: cardTitle,
            isTopicCard: true, // its title just repeats the bubble above — skip the h2
            text: data.response,
            declarations: data.declarations || [],
          },
        ]);
        setTopicCardId(aiMsgId);
      }

      if (data.declarations && data.declarations.length >= 10) setHasMore(true);
    } catch (err) {
      if (!reuseCard) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: "ai",
            isError: true,
            title: "Something went wrong",
            text: "I'm sorry, something went wrong. Please try again in a moment.",
            declarations: [],
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const startSearch = async (msg) => {
    if (!msg.trim() || loading) return;

    setLastQuery(msg.trim());
    setLastTopics([]);
    setTopicCardId(null); // a freeform ask breaks out of the topic-filter card
    setActiveTopics(new Set());
    setOutOfResults(false);
    setHasMore(false);

    const userMsgId = Date.now();
    const userMsg = {
      id: userMsgId,
      role: "user",
      text: msg.trim(),
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
          topics: [],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unknown error");

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "ai",
          title: "A word for you",
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
          isError: true,
          title: "Something went wrong",
          text: "I'm sorry, something went wrong. Please try again in a moment.",
          declarations: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Recover from a failed search without making the user retype: drop the
  // error card (and the request bubble that produced it) and re-run the same
  // topic filter or freeform ask.
  const retryLast = () => {
    if (loading) return;
    setMessages((prev) => {
      const next = [...prev];
      if (next.length && next[next.length - 1].isError) next.pop();
      if (next.length && next[next.length - 1].role === "user") next.pop();
      return next;
    });
    setTopicUserMsgId(null);
    setTopicCardId(null);
    if (lastTopics.length) runTopicSearch(lastTopics);
    else if (lastQuery) startSearch(lastQuery);
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
          topics: lastTopics,
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
    <div className="flex items-end gap-1.5 bg-white rounded-[28px] border-[1.5px] border-brand-navy/15 focus-within:border-brand-navy/50 shadow-[0_14px_44px_-20px_rgba(14,36,71,0.5)] p-2 pl-5 transition-colors">
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
        className="flex-1 bg-transparent py-2.5 font-serif text-base text-brand-ink placeholder:text-brand-gray/70 focus:outline-none resize-none min-w-0 max-h-[120px] leading-relaxed"
      />
      <button
        onClick={handleSend}
        disabled={!input.trim() || loading}
        aria-label="Send"
        className="w-[46px] h-[46px] rounded-full bg-brand-navy text-white flex items-center justify-center flex-shrink-0 hover:bg-brand-deep hover:-translate-y-px active:scale-[0.96] transition-[transform,background-color,opacity] disabled:opacity-40 disabled:hover:translate-y-0"
      >
        {loading ? (
          <Loader2 size={16} className="motion-safe:animate-spin" />
        ) : (
          <Send size={15} />
        )}
      </button>
    </div>
  );

  const themeChip = (name) => {
    const active = activeTopics.has(name.toLowerCase());
    return (
      <button
        key={name}
        onClick={() => handleTopicClick(name)}
        data-active={active}
        className={`flex-shrink-0 inline-flex items-center gap-2 rounded-full px-[17px] min-h-11 text-sm font-semibold transition-[transform,background-color,border-color,color,box-shadow] ${
          active
            ? "text-white -translate-y-px"
            : "text-brand-gray border border-transparent hover:text-brand-ink hover:bg-brand-sky/70 hover:border-brand-navy/10"
        }`}
        style={
          active
            ? {
                background: "linear-gradient(150deg, #173A68, #102A4E)",
                boxShadow: "inset 0 0 0 1px rgba(201,162,39,0.4), 0 6px 18px -8px rgba(14,36,71,0.55)",
              }
            : undefined
        }
      >
        {name}
      </button>
    );
  };

  const header = (
    <header className="border-b border-brand-navy/10 bg-gradient-to-br from-brand-sky/50 to-white px-4 sm:px-7 py-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <NavHamburger className="-ml-1" />
        <h1 className="text-base font-bold tracking-tight text-brand-ink">
          Faith Declarations
        </h1>
        <span className="text-brand-gray/50">·</span>
        <p className="text-xs text-brand-gray truncate">
          Speak God&rsquo;s Word over your life.
        </p>
        {streak >= 2 && (
          <span
            title="Days you've come to declare the Word"
            className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-navy/10 border border-brand-navy/15 text-brand-navy rounded-full text-xs font-bold uppercase tracking-wider flex-shrink-0"
          >
            <Flame size={11} />
            {streak}-day streak
          </span>
        )}
      </div>
    </header>
  );

  const speakActive = speakFromCart ? picked.size > 0 : speakMsgId !== null;

  return (
    <main id="main-content" className="h-dvh bg-white flex overflow-hidden">
      {/* Themes sidebar — left side, thread view only, stays put while the
          header and thread scroll past it. Collapses to a horizontal row
          (rendered inline in the scroll column below) on narrow screens. */}
      {hasSearched && (
        <aside inert={speakActive ? "" : undefined} className="hidden sm:flex sm:w-[196px] md:w-[220px] flex-shrink-0 flex-col h-full border-r border-brand-navy/10 bg-brand-sky/40 overflow-y-auto custom-scrollbar px-3 py-5">
          <div className="px-1 mb-3">
            <span className="text-xs font-bold uppercase tracking-[0.22em] text-brand-gray">
              Themes
            </span>
          </div>
          <div className="flex items-center justify-between px-1 mb-2.5">
            <MultiTagToggle on={multiTagMode} onClick={toggleMultiTagMode} />
            {multiTagMode && (
              <button
                type="button"
                onClick={applyMultiTagSelection}
                title="Show declarations for the selected themes"
                aria-label="Show declarations for the selected themes"
                className="w-7 h-7 rounded-full bg-brand-navy text-white flex items-center justify-center hover:bg-brand-deep transition-colors flex-shrink-0"
              >
                <ArrowRight size={13} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TOPICS.map(({ name }) => themeChip(name))}
          </div>
        </aside>
      )}

      {/* Right column: header + thread scroll together, composer stays docked */}
      <div className="flex-1 min-w-0 flex flex-col h-full" inert={speakActive ? "" : undefined}>
        {/* Scrollable stage — header scrolls away with the content now */}
        <div
          ref={threadRef}
          className="flex-1 min-h-0 overflow-y-auto custom-scrollbar"
          aria-live="polite"
        >
          {header}

          {/* Theme chips — mobile only; desktop uses the left sidebar.
              ONE line that scrolls sideways, not a wrap. Wrapping turned eight
              themes into four stacked rows (~150px) before a single
              declaration was visible, and the "Themes" label plus the Multi
              pill sat inside the wrap flow making it worse. The mode controls
              are now pinned outside the scroller so they never move, and the
              label is gone (chips on a Declarations page read as themes). */}
          {hasSearched && (
            <div className="sm:hidden border-b border-brand-navy/10 bg-white/90 backdrop-blur-md">
              <div className="flex items-center gap-1.5 px-3 py-1">
                <MultiTagToggle on={multiTagMode} onClick={toggleMultiTagMode} />
                <div
                  ref={mobileThemesRef}
                  className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)]"
                >
                  {TOPICS.map(({ name }) => themeChip(name))}
                </div>
                {multiTagMode && (
                  <button
                    type="button"
                    onClick={applyMultiTagSelection}
                    title="Show declarations for the selected themes"
                    aria-label="Show declarations for the selected themes"
                    className="w-10 h-10 rounded-full bg-brand-navy text-white flex items-center justify-center flex-shrink-0"
                  >
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>
          )}

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
                  className="relative flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.22em]"
                  style={{ color: GOLD_ON_NAVY }}
                >
                  <span className="w-[26px] h-px" style={{ background: GOLD_ON_NAVY }} />
                  Today&rsquo;s Declaration · {todayLabel}
                </p>
                <blockquote className="relative mt-4.5 font-serif font-medium leading-[1.18] tracking-tight text-balance max-w-[24ch] text-2xl sm:text-4xl mt-5">
                  &ldquo;{featured.declaration_text}&rdquo;
                </blockquote>
                <div className="relative mt-7 flex items-center gap-3.5 flex-wrap">
                  {featured.sermon_title && (
                    <span className="text-sm text-white/70 mr-auto">
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
                    className="w-11 h-11 rounded-full border border-white/35 text-white flex items-center justify-center hover:border-white/80 transition-colors flex-shrink-0"
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
                        className="inline-flex items-center gap-2 rounded-full border border-white/35 px-5 py-2.5 text-sm font-semibold text-white hover:border-white/80 hover:-translate-y-px transition-[transform,border-color]"
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
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-brand-navy/10 text-xs font-bold uppercase tracking-[0.18em] text-brand-navy">
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
              <h2 className="font-serif text-xl sm:text-3xl font-medium tracking-tight text-brand-ink text-balance mb-5">
                What do you need the Word for today?
              </h2>
              {composer("Tell us what's on your heart…")}

              {/* Theme suggestions */}
              <div className="mt-7 flex flex-wrap justify-center gap-2.5 max-w-[860px] mx-auto">
                {TOPICS.map(({ name, sub }) => (
                  <button
                    key={name}
                    onClick={() => handleTopicClick(name)}
                    className="inline-flex items-baseline gap-2 rounded-full border border-brand-navy/12 bg-white px-[18px] py-2.5 hover:-translate-y-px hover:border-[#B8862F] hover:bg-[#B8862F]/[0.06] transition-[transform,border-color,background-color] duration-[160ms]"
                  >
                    <span className="font-serif text-base font-semibold text-brand-ink">
                      {name}
                    </span>
                    <span className="hidden sm:inline text-xs text-brand-gray">{sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-9 text-center text-xs text-brand-gray">
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
                    <p className="font-serif text-base text-white bg-brand-navy rounded-[20px] rounded-br-[4px] px-5 py-3 max-w-[75%] capitalize">
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
                  className="rounded-[22px] border border-brand-navy/10 bg-white overflow-hidden shadow-sm shadow-brand-navy/5 animate-in fade-in slide-in-from-bottom-3 duration-500"
                >
                  {/* Response head — the topic-card title is skipped since it
                      just repeats the user bubble right above it */}
                  <div className="px-5 sm:px-7 pt-5 pb-4 border-b border-brand-navy/[0.07] bg-gradient-to-b from-brand-sky/70 to-transparent">
                    {!msg.isTopicCard && (
                      <h2 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-brand-ink leading-tight">
                        {msg.title}
                      </h2>
                    )}
                    {msg.text && (
                      <p
                        className={`text-sm leading-[1.6] text-brand-gray whitespace-pre-wrap ${
                          msg.isTopicCard ? "" : "mt-2.5"
                        }`}
                      >
                        {msg.text}
                      </p>
                    )}
                    {msg.isError && isLastAi && (
                      <button
                        type="button"
                        onClick={retryLast}
                        disabled={loading}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-brand-navy/20 px-4 py-2 text-xs font-bold text-brand-navy hover:bg-brand-sky transition-colors disabled:opacity-60"
                      >
                        <RotateCcw size={13} />
                        Try again
                      </button>
                    )}
                  </div>

                  {msg.declarations?.length > 0 && (
                    <>
                      {/* Tools row */}
                      <div className="flex items-center justify-between gap-3.5 flex-wrap px-5 sm:px-7 py-3.5 border-b border-brand-navy/[0.07]">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gray">
                          Speak these over your life ·{" "}
                          <span className="text-brand-ink">{msg.declarations.length}</span>
                        </p>
                        <div className="flex items-center gap-3">
                          <SelectToggle on={selectMode} onClick={toggleSelectMode} />
                          <button
                            type="button"
                            onClick={() => {
                              setSpeakFromCart(false);
                              setSpeakMsgId(msg.id);
                            }}
                            title="Speak mode"
                            aria-label="Speak mode"
                            className="w-11 h-11 rounded-full bg-brand-navy text-white flex items-center justify-center hover:bg-brand-deep hover:-translate-y-px active:scale-[0.96] transition-[transform,background-color] shadow-sm shadow-brand-navy/20"
                          >
                            <Volume2 size={16} />
                          </button>
                        </div>
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
                            selectMode={selectMode}
                            picked={picked.has(d.id || d.declaration_text)}
                            onTogglePick={togglePick}
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
                              className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-brand-navy text-brand-navy text-sm font-semibold px-6 py-2.5 hover:bg-brand-navy hover:text-white transition-colors disabled:opacity-60"
                            >
                              {fetchingMore ? (
                                <Loader2 size={15} className="motion-safe:animate-spin" />
                              ) : (
                                <>More declarations →</>
                              )}
                            </button>
                          ) : (
                            <p className="text-sm text-brand-gray max-w-xs mx-auto leading-relaxed">
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
                      className="w-2 h-2 rounded-full bg-brand-navy/40 motion-safe:animate-pulse"
                      style={{ animationDelay: `${d * 150}ms` }}
                    />
                  ))}
                </span>
                <span className="text-sm font-medium">Finding the Word for you…</span>
              </div>
            )}

            <p className="mt-6 text-center text-xs text-brand-gray">
              Every declaration was spoken by Rev. Peter in a real message — watch the
              moment behind each one.
            </p>
          </div>
        )}
      </div>

      {/* Docked composer — thread view only; home has it in-flow */}
      {hasSearched && (
        <div
          className="flex-shrink-0 px-4 sm:px-6 pt-2 pb-4 bg-gradient-to-t from-white via-white/95 to-transparent transition-transform duration-150"
          style={{
            transform: keyboardInset ? `translateY(-${keyboardInset}px)` : undefined,
            paddingBottom: keyboardInset
              ? undefined
              : "calc(1rem + env(safe-area-inset-bottom))",
          }}
        >
          <div className="max-w-[760px] mx-auto">
            {composer("Ask for more…")}
          </div>
        </div>
      )}
      </div>
      {/* ↑ closes the right column (header + thread scroll + composer) */}

      {/* Picked-declarations cart — persists across topic switches; tap to
          open Speak mode scoped to only what's been checked off. */}
      {selectMode && picked.size > 0 && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-40 flex flex-col items-stretch gap-2 w-[min(360px,calc(100vw-32px))] animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ bottom: `calc(88px + ${keyboardInset || 0}px + env(safe-area-inset-bottom))` }}
        >
          {/* Preview — what's actually in the cart, so picking across topics
              doesn't rely on memory before you commit to Speak mode. */}
          {cartOpen && (
            <div className="rounded-2xl bg-white border border-brand-navy/10 shadow-xl shadow-brand-navy/15 max-h-64 overflow-y-auto custom-scrollbar">
              {Array.from(picked.values()).map((d) => (
                <div
                  key={d.id || d.declaration_text}
                  className="flex items-start gap-2 px-3.5 py-2.5 border-b border-brand-navy/[0.06] last:border-0"
                >
                  <p className="flex-1 font-serif text-sm leading-snug text-brand-ink">
                    {d.declaration_text}
                  </p>
                  <button
                    type="button"
                    onClick={() => togglePick(d)}
                    aria-label="Remove from selection"
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-brand-gray hover:bg-brand-sky hover:text-brand-navy transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            className="flex items-center gap-3 rounded-full pl-4 pr-1.5 py-1.5 text-white shadow-lg shadow-brand-navy/30"
            style={{ background: "linear-gradient(150deg, #173A68, #102A4E)" }}
          >
            <button
              type="button"
              onClick={() => setCartOpen((v) => !v)}
              aria-expanded={cartOpen}
              className="flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap"
            >
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                style={{ background: GOLD_ON_NAVY, color: "#102A4E" }}
              >
                {picked.size}
              </span>
              selected
              <ChevronRight
                size={14}
                className={`transition-transform ${cartOpen ? "-rotate-90" : "rotate-90"}`}
              />
            </button>
            <button
              type="button"
              onClick={() => {
                setSpeakFromCart(true);
                setSpeakMsgId(null);
              }}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full text-sm font-bold px-4 py-2 hover:-translate-y-px transition-[transform]"
              style={{ background: GOLD_ON_NAVY, color: "#102A4E" }}
            >
              <Play size={11} fill="currentColor" />
              Speak these
            </button>
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
        if (speakFromCart) {
          if (picked.size === 0) return null;
          return (
            <SpeakMode
              items={Array.from(picked.values())}
              canLoadMore={false}
              loadingMore={false}
              onLoadMore={() => {}}
              onClose={() => setSpeakFromCart(false)}
              onCopy={copyDeclaration}
              onWatch={(seg) => {
                setSpeakFromCart(false);
                setWatching(seg);
              }}
            />
          );
        }
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
