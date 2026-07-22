"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Sparkles,
  ArrowUp,
  Play,
  Loader2,
  Quote,
  BookMarked,
  BookOpen,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Plus,
  Copy,
  X,
} from "lucide-react";
import { cleanTitle } from "@/lib/titles";
import { useKeyboardInset } from "@/lib/useKeyboardInset";
import VideoModal from "@/components/VideoModal";

/**
 * Ask the Word — global, cross-corpus search, laid out as a study workspace.
 *
 * Three zones: a study-outline sidebar (every question is a jump link, past
 * studies below), a reading column where questions flow chronologically with
 * the composer docked at the bottom, and — on wide screens — a sticky
 * "moments" rail beside the answer. Earlier questions condense to one-line
 * rows; the open answer gets the full anatomy: quick answer → teaching →
 * key scriptures → follow-ups. Studies persist in localStorage, so a session
 * becomes a named document the believer can come back to.
 */

const SUGGESTED = [
  "What does Rev. Peter teach about walking in faith when nothing has changed yet?",
  "How does Rev. Peter teach that the eternal life God has given us can never be taken away?",
  "How should a believer deal with unbelief in prayer?",
  "What is the believer's righteousness in Christ?",
  "How do I recognise the leading of the Holy Spirit?",
  "Why does Rev. Peter emphasise the local church so much?",
];

const STORE_KEY = "hof-ask-studies-v2";
const LEGACY_KEY = "hof-ask-study-v1";
const MAX_STUDIES = 12;
const MAX_BLOCKS = 30;
const RAIL_PREVIEW = 4; // moments shown in the side rail before "Show all"

const fmtTime = (secs) => {
  const s = Math.max(0, Math.floor(secs || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
};

const fmtDate = (ts) =>
  new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// Strip markdown + citation markers (for the copied study / plain contexts).
const plainText = (t) =>
  (t || "").replace(/\*\*/g, "").replace(/\[\d+\]/g, "").replace(/[ \t]+/g, " ").trim();

// Auto-name a study from its first question.
const titleFrom = (q) => {
  const t = q
    .replace(
      /^\s*(what|how|why|when|where|who)\s+(does|do|did|should|can|is|are)\s+(rev\.?\s*peter\s+)?(teach(es)?\s+(about|that|us)?\s*)?/i,
      ""
    )
    .replace(/\?+\s*$/, "")
    .trim();
  const s = t.length > 3 ? t[0].toUpperCase() + t.slice(1) : q.replace(/\?+\s*$/, "");
  return s.length > 46 ? `${s.slice(0, 46).trimEnd()}…` : s;
};

// ── Scripture references get highlighted so the verses pop out of the prose ──
const BIBLE_BOOKS =
  "Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation";

// Lookbehinds keep "Rev. Peter" from matching as the book of Peter.
const SCRIPTURE_RE = new RegExp(
  `(?<!Rev\\.\\s)(?<!Rev\\s)\\b(?:[1-3]\\s)?(?:${BIBLE_BOOKS})\\s\\d+(?::\\d+(?:[-–]\\d+)?)?\\b`,
  "g"
);

const extractScriptures = (text) => {
  const re = new RegExp(SCRIPTURE_RE.source, "g");
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(text || ""))) {
    const v = m[0].replace(/\s+/g, " ");
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
};

function renderScripture(text, keyBase) {
  const out = [];
  let last = 0;
  let m;
  const re = new RegExp(SCRIPTURE_RE.source, "g");
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <span
        key={`${keyBase}-s${m.index}`}
        className="font-semibold text-brand-navy bg-brand-sky rounded-md px-1 py-px whitespace-nowrap"
      >
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function renderRich(text, keyBase) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) => {
    if (/^\*\*[^*]+\*\*$/.test(chunk)) {
      return (
        <strong key={`${keyBase}-b${i}`} className="font-bold text-brand-ink">
          {renderScripture(chunk.slice(2, -2), `${keyBase}-b${i}`)}
        </strong>
      );
    }
    return (
      <span key={`${keyBase}-t${i}`}>{renderScripture(chunk, `${keyBase}-t${i}`)}</span>
    );
  });
}

// ── One answer paragraph: **bold**, scripture chips, [N] citation pills ──────
const CITE_RE = /(\[\d+\](?:\s*\[\d+\])*|\[\d+(?:,\s*\d+)+\])/;

function CitationPill({ n, onJump }) {
  return (
    <button
      onClick={() => onJump(n)}
      className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-brand-navy/10 border border-brand-navy/20 text-xs font-bold text-brand-navy align-super -translate-y-0.5 mx-0.5 hover:bg-brand-navy hover:text-white transition-colors"
      title="Jump to this source"
    >
      {n}
    </button>
  );
}

function RichParagraph({ text, onJump, className, pKey }) {
  const parts = text.split(new RegExp(CITE_RE.source, "g"));
  return (
    <p className={className}>
      {parts.map((part, i) => {
        if (part && CITE_RE.test(part)) {
          const nums = [...part.matchAll(/\d+/g)].map((m) => m[0]);
          return nums.map((n, j) => (
            <CitationPill key={`${pKey}-${i}-${j}`} n={n} onJump={onJump} />
          ));
        }
        return (
          <span key={`${pKey}-${i}`}>{renderRich(part, `${pKey}-${i}`)}</span>
        );
      })}
    </p>
  );
}

// ── Source card — used by the inline rail and the side rail ──────────────────
function SourceCard({ n, seg, blockId, highlighted, onWatch, idPrefix = "src", className = "" }) {
  return (
    <div
      id={`${idPrefix}-${blockId}-${n}`}
      className={`rounded-2xl border bg-white overflow-hidden transition-all duration-500 ${
        highlighted
          ? "border-brand-navy ring-2 ring-brand-navy/30 shadow-lg shadow-brand-navy/10"
          : "border-brand-navy/10 hover:border-brand-navy/25 hover:shadow-md hover:shadow-brand-navy/5"
      } ${className}`}
    >
      {seg.video_id ? (
        <button
          type="button"
          onClick={() => onWatch(seg)}
          className="group relative block w-full aspect-video bg-brand-sky"
          title="Watch this moment"
        >
          <img
            src={`https://img.youtube.com/vi/${seg.video_id}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
          />
          <span className="absolute top-2 left-2 w-6 h-6 rounded-full bg-white/95 text-brand-navy text-xs font-bold flex items-center justify-center shadow">
            {n}
          </span>
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-bold text-white tabular-nums">
            <Play size={9} fill="currentColor" />
            {fmtTime(seg.start_seconds)}
          </span>
          <span className="absolute inset-0 flex items-center justify-center bg-brand-deep/0 group-hover:bg-brand-deep/30 transition-colors">
            <span className="w-10 h-10 rounded-full bg-white/95 text-brand-navy flex items-center justify-center opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all">
              <Play size={16} fill="currentColor" className="translate-x-px" />
            </span>
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-2 px-3.5 pt-3.5">
          <span className="w-6 h-6 rounded-full bg-brand-navy text-white text-xs font-bold flex items-center justify-center">
            {n}
          </span>
        </div>
      )}
      <div className="p-3.5">
        <p className="text-xs font-bold text-brand-ink leading-snug line-clamp-2">
          {seg.sermon_title}
        </p>
        <p className="mt-1.5 text-xs italic text-brand-gray leading-relaxed line-clamp-3">
          &ldquo;{seg.text}&rdquo;
        </p>
        <div className="mt-2.5 flex items-center gap-3">
          {seg.video_id && (
            <button
              type="button"
              onClick={() => onWatch(seg)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-navy hover:underline"
            >
              <Play size={10} fill="currentColor" />
              Watch this moment
            </button>
          )}
          {seg.sermon_id && (
            <Link
              href={`/sermon/${seg.sermon_id}`}
              className="inline-flex items-center gap-1 text-xs font-bold text-brand-gray hover:text-brand-navy"
            >
              Message
              <ArrowUpRight size={11} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Inline horizontal rail — mobile / narrow screens (side rail takes over on xl)
function InlineSourceRail({ blockId, sources, highlight, onWatch }) {
  const railRef = useRef(null);
  const nudge = (dir) =>
    railRef.current?.scrollBy({ left: dir * 540, behavior: "smooth" });

  return (
    <div className="mt-6 xl:hidden">
      <div className="flex items-center justify-between mb-3">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-gray">
          <Quote size={13} className="text-brand-navy" />
          Heard in these moments · {sources.length}
        </p>
        <div className="hidden sm:flex items-center gap-1.5">
          <button
            onClick={() => nudge(-1)}
            aria-label="Scroll sources left"
            className="w-8 h-8 rounded-full border border-brand-navy/15 bg-white text-brand-navy flex items-center justify-center hover:bg-brand-sky transition-colors"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => nudge(1)}
            aria-label="Scroll sources right"
            className="w-8 h-8 rounded-full border border-brand-navy/15 bg-white text-brand-navy flex items-center justify-center hover:bg-brand-sky transition-colors"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <div
        ref={railRef}
        className="flex gap-3 overflow-x-auto snap-x pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sources.map(([n, seg]) => (
          <SourceCard
            key={n}
            n={n}
            seg={seg}
            blockId={blockId}
            highlighted={highlight === `${blockId}-${n}`}
            onWatch={onWatch}
            className="w-[236px] sm:w-[256px] flex-shrink-0 snap-start"
          />
        ))}
      </div>
    </div>
  );
}

export default function AskPage() {
  const [input, setInput] = useState("");
  const [studies, setStudies] = useState([]); // newest study first; blocks oldest-first
  const [activeId, setActiveId] = useState(null);
  const [openId, setOpenId] = useState(null); // expanded question in the thread
  const [railExpanded, setRailExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [highlight, setHighlight] = useState(null); // `${blockId}-${n}`
  const [restored, setRestored] = useState(false);
  const [toast, setToast] = useState(null);
  const [watching, setWatching] = useState(null); // segment currently open in the video modal
  const [studiesOpen, setStudiesOpen] = useState(false); // mobile "Studies" bottom sheet
  const inputRef = useRef(null);
  const toastTimer = useRef(null);
  const keyboardInset = useKeyboardInset();

  const active = studies.find((s) => s.id === activeId) || null;
  const blocks = active?.blocks ?? [];
  const hasBlocks = blocks.length > 0;
  const openBlock = blocks.find((b) => b.id === openId) || null;
  const openSources = Object.entries(openBlock?.segmentMap || {});

  // Lock body scroll + close on Escape while the mobile studies sheet is open.
  useEffect(() => {
    if (!studiesOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setStudiesOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [studiesOpen]);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  // Restore saved studies once on mount (client-only); migrate the v1 format.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const cleaned = (saved?.studies || [])
          .filter((s) => s && s.id && Array.isArray(s.blocks) && s.blocks.length)
          .map((s) => ({
            ...s,
            blocks: s.blocks
              .filter((b) => b && b.id && b.question)
              .map((b) => ({
                ...b,
                status: b.status === "error" ? "error" : "done",
              })),
          }));
        if (cleaned.length) {
          setStudies(cleaned);
          const act =
            cleaned.find((s) => s.id === saved.activeId) || cleaned[0];
          setActiveId(act.id);
          setOpenId(act.blocks[act.blocks.length - 1]?.id ?? null);
        }
      } else {
        // v1: a single flat list of blocks, newest first.
        const legacy = localStorage.getItem(LEGACY_KEY);
        if (legacy) {
          const old = JSON.parse(legacy);
          if (Array.isArray(old) && old.length) {
            const blocksAsc = [...old]
              .reverse()
              .filter((b) => b && b.id && b.question)
              .map((b) => ({
                ...b,
                status: b.status === "error" ? "error" : "done",
              }));
            if (blocksAsc.length) {
              const study = {
                id: blocksAsc[0].id,
                title: titleFrom(blocksAsc[0].question),
                createdAt: blocksAsc[0].id,
                updatedAt: Date.now(),
                blocks: blocksAsc,
              };
              setStudies([study]);
              setActiveId(study.id);
              setOpenId(blocksAsc[blocksAsc.length - 1].id);
            }
          }
          localStorage.removeItem(LEGACY_KEY);
        }
      }
    } catch {
      /* corrupted save — start fresh */
    }
    setRestored(true);
  }, []);

  // Persist whenever everything settles (never mid-stream).
  useEffect(() => {
    if (!restored) return;
    try {
      const streaming = studies.some((s) =>
        s.blocks.some((b) => b.status === "searching" || b.status === "answering")
      );
      if (streaming) return;
      const toSave = studies
        .filter((s) => s.blocks.length)
        .slice(0, MAX_STUDIES)
        .map((s) => ({ ...s, blocks: s.blocks.slice(-MAX_BLOCKS) }));
      if (!toSave.length) {
        localStorage.removeItem(STORE_KEY);
        return;
      }
      localStorage.setItem(STORE_KEY, JSON.stringify({ activeId, studies: toSave }));
    } catch {
      /* storage full or unavailable — studies just won't persist */
    }
  }, [studies, activeId, restored]);

  const scrollToBlock = (id) =>
    setTimeout(() => {
      const el = document.getElementById(`block-${id}`);
      if (!el) return;
      let node = el.parentElement;
      while (
        node &&
        !(
          /(auto|scroll)/.test(getComputedStyle(node).overflowY) &&
          node.scrollHeight > node.clientHeight
        )
      )
        node = node.parentElement;
      if (node)
        smoothScrollBy(node, {
          top:
            el.getBoundingClientRect().top -
            node.getBoundingClientRect().top -
            12,
        });
    }, 80);

  const activateBlock = (id) => {
    setOpenId(id);
    setRailExpanded(false);
    scrollToBlock(id);
  };

  // Center an element inside every scrollable ancestor. scrollIntoView is
  // unreliable across nested overflow containers, so scroll them directly —
  // smooth when the browser animates it, snapping if it doesn't (some
  // embedded/reduced-motion environments ignore smooth scrolling entirely).
  const smoothScrollBy = (node, delta) => {
    const start = { top: node.scrollTop, left: node.scrollLeft };
    node.scrollBy({ ...delta, behavior: "smooth" });
    setTimeout(() => {
      const moved =
        node.scrollTop !== start.top || node.scrollLeft !== start.left;
      if (!moved) {
        if (delta.top) node.scrollTop = start.top + delta.top;
        if (delta.left) node.scrollLeft = start.left + delta.left;
      }
    }, 350);
  };

  const centerInScrollParents = (el) => {
    let node = el.parentElement;
    while (node) {
      const style = getComputedStyle(node);
      const canY =
        /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight;
      const canX =
        /(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth;
      if (canY || canX) {
        const nr = node.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        const delta = {};
        if (canY) delta.top = er.top - nr.top - (nr.height - er.height) / 2;
        if (canX) delta.left = er.left - nr.left - (nr.width - er.width) / 2;
        smoothScrollBy(node, delta);
      }
      node = node.parentElement;
    }
  };

  const jumpToSource = (blockId, n) => {
    const useSideRail =
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1280px)").matches;
    if (useSideRail && Number(n) > RAIL_PREVIEW) setRailExpanded(true);
    const id = `${useSideRail ? "srcr" : "src"}-${blockId}-${n}`;
    // The expanded rail may still be rendering when we go looking for the
    // card, so retry until it exists (dev renders can take a moment).
    const tryScroll = (attempt) => {
      const el = document.getElementById(id);
      if (el) centerInScrollParents(el);
      else if (attempt < 14) setTimeout(() => tryScroll(attempt + 1), 150);
    };
    tryScroll(0);
    setHighlight(`${blockId}-${n}`);
    setTimeout(() => setHighlight(null), 2600);
  };

  const newStudy = () => {
    setStudies((prev) => prev.filter((s) => s.blocks.length));
    setActiveId(null);
    setOpenId(null);
    setRailExpanded(false);
    inputRef.current?.focus();
  };

  const switchStudy = (id) => {
    const st = studies.find((s) => s.id === id);
    if (!st) return;
    setStudies((prev) => prev.filter((s) => s.blocks.length || s.id === id));
    setActiveId(id);
    const last = st.blocks[st.blocks.length - 1]?.id ?? null;
    setOpenId(last);
    setRailExpanded(false);
    setStudiesOpen(false);
    if (last) scrollToBlock(last);
  };

  const copyStudy = async () => {
    if (!active) return;
    const lines = [`${active.title} — Ask the Word study`, ""];
    active.blocks.forEach((b, i) => {
      lines.push(`${i + 1}. ${b.question}`, "", plainText(b.answer), "");
    });
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      showToast("Study copied to clipboard");
    } catch {
      showToast("Couldn't copy — clipboard unavailable");
    }
  };

  const ask = async (question) => {
    const q = (question ?? input).trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);

    const blockId = Date.now();
    const studyId = active ? active.id : blockId;
    const newBlock = {
      id: blockId,
      question: q,
      answer: "",
      segmentMap: {},
      suggestions: [],
      status: "searching",
    };

    setStudies((prev) => {
      if (prev.some((s) => s.id === studyId)) {
        return prev.map((s) =>
          s.id === studyId
            ? { ...s, updatedAt: blockId, blocks: [...s.blocks, newBlock] }
            : s
        );
      }
      return [
        {
          id: studyId,
          title: titleFrom(q),
          createdAt: blockId,
          updatedAt: blockId,
          blocks: [newBlock],
        },
        ...prev,
      ];
    });
    setActiveId(studyId);
    setOpenId(blockId);
    setRailExpanded(false);
    scrollToBlock(blockId);

    const patch = (fields) =>
      setStudies((prev) =>
        prev.map((s) =>
          s.id !== studyId
            ? s
            : {
                ...s,
                updatedAt: Date.now(),
                blocks: s.blocks.map((b) =>
                  b.id === blockId ? { ...b, ...fields } : b
                ),
              }
        )
      );

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Something went wrong.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      let headerParsed = false;
      let segmentMap = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });

        // Wait until the full SEGMENT_MAP header line has arrived before parsing
        // (it can be several KB and span multiple chunks).
        if (!headerParsed) {
          const nl = raw.indexOf("\n");
          if (nl === -1) continue;
          const firstLine = raw.slice(0, nl);
          if (firstLine.startsWith("SEGMENT_MAP:")) {
            try {
              segmentMap = JSON.parse(firstLine.slice("SEGMENT_MAP:".length));
            } catch {
              /* leave sources empty */
            }
            raw = raw.slice(nl + 1);
          }
          headerParsed = true;
        }

        // Peel SUGGESTIONS off the end.
        let answer = raw;
        let suggestions = [];
        const si = raw.lastIndexOf("SUGGESTIONS:");
        if (si !== -1) {
          answer = raw.slice(0, si).trim();
          try {
            suggestions = JSON.parse(raw.slice(si + "SUGGESTIONS:".length).trim());
          } catch {
            /* still streaming the suggestions array */
          }
        }

        patch({
          answer,
          suggestions,
          segmentMap,
          status: "answering",
        });
      }

      patch({ status: "done" });
    } catch (err) {
      patch({
        status: "error",
        answer: `I ran into a problem: ${err.message}`,
      });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const retry = (block) => {
    if (busy) return;
    setStudies((prev) =>
      prev.map((s) =>
        s.id !== activeId
          ? s
          : { ...s, blocks: s.blocks.filter((b) => b.id !== block.id) }
      )
    );
    ask(block.question);
  };

  const recentStudies = studies
    .filter((s) => s.id !== activeId && s.blocks.length)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 6);

  return (
    <main className="h-dvh bg-white flex flex-col lg:grid lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_304px]">
      {/* ── Zone 1 · Study outline ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col min-h-0 bg-brand-light border-r border-brand-navy/10">
        <div className="px-5 pt-5 pb-4">
          <Link href="/" className="inline-flex">
            <Image
              src="/hofng-logo.png"
              alt="Heritage of Faith — Home"
              width={100}
              height={32}
              className="h-7 w-auto object-contain"
              priority
            />
          </Link>
          <p className="mt-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-brand-navy">
            <Sparkles size={12} />
            Ask the Word
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 pb-4">
          {active ? (
            <>
              <div className="px-2 pb-2">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-gray">
                  This study
                </p>
                <p className="mt-1 text-sm font-bold text-brand-ink leading-snug">
                  {active.title}
                </p>
                <p className="mt-0.5 text-xs text-brand-gray">
                  {blocks.length} {blocks.length === 1 ? "question" : "questions"} ·{" "}
                  {fmtDate(active.createdAt)}
                </p>
              </div>
              <ul className="flex flex-col gap-0.5">
                {blocks.map((b, i) => (
                  <li key={b.id}>
                    <button
                      onClick={() => activateBlock(b.id)}
                      className={`w-full flex gap-2.5 items-baseline text-left rounded-xl px-2.5 py-2 text-xs leading-snug transition-colors ${
                        openId === b.id
                          ? "bg-brand-sky text-brand-ink font-semibold shadow-[inset_2.5px_0_0_#173A68]"
                          : "text-brand-ink/80 hover:bg-brand-sky/60"
                      }`}
                    >
                      <span
                        className={`text-xs font-bold tabular-nums flex-shrink-0 ${
                          openId === b.id ? "text-brand-navy" : "text-brand-gray"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="line-clamp-2">{b.question}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => inputRef.current?.focus()}
                className="mt-3 mx-2.5 inline-flex items-center gap-1.5 text-xs font-bold text-brand-navy hover:underline"
              >
                <Plus size={13} />
                Ask a new question
              </button>
            </>
          ) : (
            <p className="px-2 text-xs text-brand-gray leading-relaxed">
              Ask your first question and this study will build its own outline
              here.
            </p>
          )}

          {recentStudies.length > 0 && (
            <>
              <hr className="border-brand-navy/10 my-4 mx-2" />
              <p className="px-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-gray mb-1.5">
                Recent studies
              </p>
              <ul className="flex flex-col gap-0.5">
                {recentStudies.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => switchStudy(s.id)}
                      className="w-full text-left rounded-xl px-2.5 py-2 hover:bg-brand-sky/60 transition-colors"
                    >
                      <span className="block text-xs font-semibold text-brand-ink leading-snug line-clamp-1">
                        {s.title}
                      </span>
                      <span className="block text-xs text-brand-gray mt-0.5">
                        {fmtDate(s.createdAt)} · {s.blocks.length}{" "}
                        {s.blocks.length === 1 ? "question" : "questions"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-brand-navy/10">
          <p className="text-xs text-brand-gray leading-relaxed">
            Every answer is grounded in Rev. Peter&rsquo;s recorded messages.
            Studies save automatically on this device.
          </p>
        </div>
      </aside>

      {/* ── Zone 2 · Reading column ────────────────────────────────────────── */}
      <section className="flex flex-col min-h-0 min-w-0 flex-1">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 sm:px-6 py-2.5 border-b border-brand-navy/10 flex-shrink-0 bg-white">
          <Link href="/" className="lg:hidden flex-shrink-0">
            <Image
              src="/hofng-logo.png"
              alt="Heritage of Faith — Home"
              width={80}
              height={26}
              className="h-6 w-auto object-contain"
            />
          </Link>
          <p className="flex-1 min-w-0 truncate text-xs text-brand-gray">
            {active ? (
              <>
                Studying:{" "}
                <span className="font-semibold text-brand-ink">{active.title}</span>
              </>
            ) : (
              "New study"
            )}
          </p>
          {recentStudies.length > 0 && (
            <button
              onClick={() => setStudiesOpen(true)}
              aria-label="Past studies"
              className="lg:hidden inline-flex items-center gap-1.5 text-xs font-bold text-brand-navy border border-brand-navy/15 rounded-full px-3.5 py-1.5 hover:bg-brand-sky transition-colors flex-shrink-0"
            >
              <BookOpen size={12} />
              <span className="hidden sm:inline">Studies</span>
            </button>
          )}
          {active && (
            <button
              onClick={copyStudy}
              aria-label="Copy study"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-navy border border-brand-navy/15 rounded-full px-3.5 py-1.5 hover:bg-brand-sky transition-colors flex-shrink-0"
            >
              <Copy size={12} />
              <span className="hidden sm:inline">Copy study</span>
            </button>
          )}
          <button
            onClick={newStudy}
            aria-label="New study"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-navy border border-brand-navy/15 rounded-full px-3.5 py-1.5 hover:bg-brand-sky transition-colors flex-shrink-0"
          >
            <Plus size={12} />
            <span className="hidden sm:inline">New study</span>
          </button>
        </div>

        {/* Thread */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative">
          {!hasBlocks ? (
            /* Empty study — hero */
            <div className="h-full flex flex-col items-center justify-center px-4 sm:px-6 py-10 relative">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[300px] bg-gradient-to-b from-brand-sky/70 to-transparent" />
              <div className="relative text-center max-w-xl">
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-brand-navy/10 text-xs font-bold uppercase tracking-[0.18em] text-brand-navy">
                  <Sparkles size={13} />
                  Ask · every message
                </span>
                <h1 className="mt-5 text-4xl sm:text-5xl font-bold text-brand-ink tracking-tight leading-[1.05]">
                  Ask the Word.
                </h1>
                <p className="mt-4 text-brand-gray text-base sm:text-lg leading-relaxed">
                  One question, answered from everything Rev. Peter has taught —
                  grounded in his exact words, with the moments to watch.
                </p>
                <div className="mt-7 flex flex-wrap justify-center gap-2">
                  {SUGGESTED.map((s) => (
                    <button
                      key={s}
                      onClick={() => ask(s)}
                      className="text-left text-sm font-medium text-brand-navy bg-white border border-brand-navy/10 rounded-full px-4 py-2 hover:bg-brand-sky hover:border-brand-navy/25 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
              {blocks.map((b, i) => {
                const open = openId === b.id;
                const sources = Object.entries(b.segmentMap || {});
                const num = i + 1;

                if (!open) {
                  return (
                    <article key={b.id} id={`block-${b.id}`} className="scroll-mt-3 mb-2.5">
                      <button
                        onClick={() => activateBlock(b.id)}
                        aria-expanded={false}
                        className="w-full flex items-center gap-3.5 text-left rounded-2xl border border-brand-navy/10 bg-brand-light px-4 py-3.5 hover:border-brand-navy/30 hover:bg-brand-sky/40 transition-colors"
                      >
                        <span className="flex-shrink-0 text-xs font-bold text-brand-navy/40 tabular-nums">
                          {num}
                        </span>
                        <span className="min-w-0 flex-1 text-sm font-bold text-brand-ink leading-snug line-clamp-1">
                          {b.question}
                        </span>
                        {sources.length > 0 && (
                          <span className="hidden sm:block flex-shrink-0 text-xs text-brand-gray">
                            {sources.length} moments
                          </span>
                        )}
                        <ChevronDown size={16} className="flex-shrink-0 text-brand-navy/40" />
                      </button>
                    </article>
                  );
                }

                const paras = (b.answer || "").split(/\n{2,}/).filter((p) => p.trim());
                const lead = paras[0];
                const rest = paras.slice(1);
                const hasSources = sources.length > 0;
                const scriptures =
                  b.status === "done" && hasSources ? extractScriptures(b.answer) : [];

                return (
                  <article key={b.id} id={`block-${b.id}`} className="scroll-mt-3 mb-8 pt-3">
                    {/* Question */}
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-navy/60 mb-2">
                      Question {num}
                    </p>
                    <h2 className="text-2xl sm:text-3xl font-bold text-brand-ink tracking-tight leading-tight">
                      {b.question}
                    </h2>

                    {/* Searching state */}
                    {b.status === "searching" && (
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
                        <span className="text-sm font-medium">
                          Searching every message…
                        </span>
                      </div>
                    )}

                    {/* Quick answer — the opening sentence, called out */}
                    {lead && hasSources && b.status !== "error" && (
                      <div className="mt-6 rounded-r-2xl rounded-l-md border border-brand-navy/10 border-l-[3px] border-l-brand-navy bg-gradient-to-br from-brand-sky/60 to-white px-5 py-4">
                        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-navy mb-1.5">
                          Quick answer
                          {b.status === "answering" && rest.length === 0 && (
                            <Loader2 size={12} className="animate-spin text-brand-navy/40" />
                          )}
                        </p>
                        <RichParagraph
                          text={lead}
                          onJump={(n) => jumpToSource(b.id, n)}
                          pKey={`${b.id}-lead`}
                          className="text-base font-semibold text-brand-ink leading-[1.6]"
                        />
                      </div>
                    )}

                    {/* The teaching */}
                    {rest.length > 0 && hasSources && (
                      <div className="mt-6">
                        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-navy mb-3.5">
                          <span className="w-7 h-7 rounded-lg bg-brand-navy text-white flex items-center justify-center">
                            <BookMarked size={14} />
                          </span>
                          What Rev. Peter teaches
                          {b.status === "answering" && (
                            <Loader2 size={13} className="animate-spin text-brand-navy/40 ml-auto" />
                          )}
                        </p>
                        <div className="space-y-4 text-base leading-[1.78] text-brand-ink/90">
                          {rest.map((para, pi) => (
                            <RichParagraph
                              key={pi}
                              text={para}
                              onJump={(n) => jumpToSource(b.id, n)}
                              pKey={`${b.id}-${pi}`}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No sources (honest refusal) or error */}
                    {b.answer && !hasSources && (
                      <div className="mt-6 rounded-2xl border border-brand-navy/10 bg-brand-light px-5 py-4">
                        <p className="text-base leading-[1.7] text-brand-ink/90">
                          {plainText(b.answer)}
                        </p>
                        {b.status === "error" && (
                          <button
                            onClick={() => retry(b)}
                            className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-brand-navy border border-brand-navy/20 rounded-full px-3.5 py-1.5 hover:bg-brand-sky transition-colors"
                          >
                            <RotateCcw size={12} />
                            Try again
                          </button>
                        )}
                      </div>
                    )}

                    {/* Key scriptures */}
                    {scriptures.length > 0 && (
                      <div className="mt-6">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-gray mb-2.5">
                          Key scriptures in this answer
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {scriptures.map((v) => (
                            <span
                              key={v}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-navy bg-brand-sky border border-brand-navy/10 rounded-full px-3.5 py-1.5"
                            >
                              <BookOpen size={12} />
                              {v}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inline moments rail (narrow screens) */}
                    {hasSources && (
                      <InlineSourceRail
                        blockId={b.id}
                        sources={sources}
                        highlight={highlight}
                        onWatch={setWatching}
                      />
                    )}

                    {/* Follow-up suggestions */}
                    {b.status === "done" && b.suggestions?.length > 0 && (
                      <div className="mt-7">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-gray mb-3">
                          Keep exploring
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {b.suggestions.map((s, si) => (
                            <button
                              key={si}
                              onClick={() => ask(s)}
                              className="text-left text-sm font-medium text-brand-navy bg-white border border-brand-navy/10 rounded-full px-4 py-2 hover:bg-brand-sky hover:border-brand-navy/25 transition-colors"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Composer — docked at the bottom */}
        <div
          className="flex-shrink-0 border-t border-brand-navy/10 bg-white px-4 sm:px-6 pt-3 pb-3.5 transition-transform duration-150"
          style={{
            transform: keyboardInset ? `translateY(-${keyboardInset}px)` : undefined,
            paddingBottom: keyboardInset
              ? undefined
              : "calc(0.875rem + env(safe-area-inset-bottom))",
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
            className="max-w-2xl mx-auto"
          >
            <div className="flex items-center gap-2 bg-brand-light rounded-2xl border border-brand-navy/15 focus-within:border-brand-navy/40 shadow-sm p-1.5 pl-4 transition-colors">
              <Sparkles size={17} className="text-brand-navy/50 flex-shrink-0" />
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  hasBlocks
                    ? "Ask a follow-up — it stays in this study…"
                    : "Ask anything across every message…"
                }
                className="flex-1 bg-transparent py-2 text-base text-brand-ink placeholder:text-brand-gray/60 focus:outline-none min-w-0"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Ask"
                className="w-10 h-10 rounded-xl bg-brand-navy text-white flex items-center justify-center flex-shrink-0 hover:bg-brand-deep transition-colors disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <ArrowUp size={17} />
                )}
              </button>
            </div>
            <p className="mt-1.5 text-center text-xs text-brand-gray">
              Answers come only from Rev. Peter&rsquo;s recorded messages — every
              claim is cited.
            </p>
          </form>
        </div>
      </section>

      {/* ── Zone 3 · Moments rail (wide screens) ───────────────────────────── */}
      <aside className="hidden xl:flex flex-col min-h-0 bg-brand-light border-l border-brand-navy/10">
        <div className="flex items-baseline justify-between px-4 pt-5 pb-3 flex-shrink-0">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-gray">
            <Quote size={12} className="text-brand-navy" />
            Heard in these moments
          </p>
          {openSources.length > 0 && (
            <span className="text-xs font-bold text-brand-gray">
              {openSources.length}
            </span>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 pb-4">
          {openSources.length === 0 ? (
            <p className="text-xs text-brand-gray leading-relaxed pt-1">
              The exact sermon moments behind each answer will appear here as
              you ask.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {(railExpanded
                  ? openSources
                  : openSources.slice(0, RAIL_PREVIEW)
                ).map(([n, seg]) => (
                  <SourceCard
                    key={n}
                    n={n}
                    seg={seg}
                    blockId={openBlock.id}
                    highlighted={highlight === `${openBlock.id}-${n}`}
                    onWatch={setWatching}
                    idPrefix="srcr"
                    className="w-full"
                  />
                ))}
              </div>
              {openSources.length > RAIL_PREVIEW && (
                <button
                  onClick={() => setRailExpanded((v) => !v)}
                  className="mt-3 w-full text-center text-xs font-bold text-brand-navy border border-dashed border-brand-navy/20 rounded-xl py-2.5 hover:bg-brand-sky transition-colors"
                >
                  {railExpanded
                    ? "Show fewer"
                    : `Show all ${openSources.length} moments`}
                </button>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-brand-ink text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {/* ── Mobile studies sheet (Zone 1 sidebar is hidden below lg) ──────── */}
      {studiesOpen && (
        <div
          className="fixed inset-0 z-40 bg-brand-ink/40 lg:hidden"
          onClick={() => setStudiesOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`lg:hidden fixed inset-x-0 bottom-0 top-16 z-50 flex flex-col min-h-0 rounded-t-3xl border-t border-brand-navy/10 bg-brand-light shadow-2xl transition-transform duration-300 ${
          studiesOpen ? "translate-y-0" : "translate-y-full pointer-events-none"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-brand-light/95 backdrop-blur px-4 py-3 border-b border-brand-navy/10">
          <p className="text-sm font-bold text-brand-ink">Your studies</p>
          <button
            onClick={() => setStudiesOpen(false)}
            aria-label="Close"
            className="w-11 h-11 -mr-2 flex items-center justify-center rounded-full text-brand-gray hover:text-brand-navy hover:bg-brand-sky transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <ul className="flex flex-col gap-1">
            {recentStudies.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => switchStudy(s.id)}
                  className={`w-full text-left rounded-2xl px-4 py-3 transition-colors ${
                    s.id === activeId
                      ? "bg-brand-sky shadow-[inset_2.5px_0_0_#173A68]"
                      : "hover:bg-brand-sky/60"
                  }`}
                >
                  <span className="block text-sm font-semibold text-brand-ink leading-snug line-clamp-1">
                    {s.title}
                  </span>
                  <span className="block text-xs text-brand-gray mt-0.5">
                    {fmtDate(s.createdAt)} · {s.blocks.length}{" "}
                    {s.blocks.length === 1 ? "question" : "questions"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              newStudy();
              setStudiesOpen(false);
            }}
            className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-brand-navy/15 bg-white px-4 py-3 text-sm font-bold text-brand-navy hover:bg-brand-sky transition-colors"
          >
            <Plus size={15} />
            Start a new study
          </button>
        </div>
      </aside>

      <VideoModal seg={watching} onClose={() => setWatching(null)} />
    </main>
  );
}
