"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Sparkles,
  ArrowUp,
  Play,
  Loader2,
  Quote,
  BookOpen,
  ArrowUpRight,
  ChevronDown,
  RotateCcw,
  Plus,
  Copy,
  X,
} from "lucide-react";
import { cleanTitle } from "@/lib/titles";
import { useKeyboardInset } from "@/lib/useKeyboardInset";
import VideoModal from "@/components/VideoModal";
import NavHamburger from "@/components/NavHamburger";
import { fetchPassage, parseReference, TRANSLATIONS } from "@/lib/bible";

/**
 * Ask the Word — global, cross-corpus search, laid out as a study workspace.
 *
 * Three zones: a study-outline sidebar (every question is a jump link, past
 * studies below), a reading column where questions flow chronologically with
 * the composer docked at the bottom, and — on wide screens — a sticky
 * "moments" rail beside the answer. Earlier questions condense to one-line
 * rows; the open answer renders as one flowing passage with inline [N]
 * citations (each opens the source clip directly), followed by key
 * scriptures and follow-ups. Studies persist in localStorage, so a session
 * becomes a named document the believer can come back to.
 */

const SUGGESTED = [
  "Walking in faith before things change",
  "Our eternal life — can it be lost?",
  "Dealing with unbelief in prayer",
  "The believer's righteousness in Christ",
  "Recognising the Holy Spirit's leading",
  "Why Rev. Peter values the local church",
  "How to activate the blessing",
  "What born again really means",
  "Faith versus feelings — what wins?",
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

function renderScripture(text, keyBase, onVerseClick) {
  const out = [];
  let last = 0;
  let m;
  const re = new RegExp(SCRIPTURE_RE.source, "g");
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <button
        key={`${keyBase}-s${m.index}`}
        type="button"
        onClick={() => onVerseClick?.(m[0])}
        className="font-semibold text-brand-navy bg-brand-sky rounded-md px-1 py-px whitespace-nowrap hover:bg-brand-navy hover:text-white transition-colors cursor-pointer"
      >
        {m[0]}
      </button>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function renderRich(text, keyBase, onVerseClick) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) => {
    if (/^\*\*[^*]+\*\*$/.test(chunk)) {
      return (
        <strong key={`${keyBase}-b${i}`} className="font-bold text-brand-ink">
          {renderScripture(chunk.slice(2, -2), `${keyBase}-b${i}`, onVerseClick)}
        </strong>
      );
    }
    return (
      <span key={`${keyBase}-t${i}`}>
        {renderScripture(chunk, `${keyBase}-t${i}`, onVerseClick)}
      </span>
    );
  });
}

// ── One answer paragraph: **bold**, scripture chips, [N] citation pills ──────
const CITE_RE = /(\[\d+\](?:\s*\[\d+\])*|\[\d+(?:,\s*\d+)+\])/;

function CitationPill({ n, seg, onWatch }) {
  if (!seg?.video_id) return <sup className="text-gray-400 text-xs">[{n}]</sup>;

  return (
    <button
      type="button"
      onClick={() => onWatch(seg)}
      title={`"${seg.text}" — ${seg.sermon_title}`}
      className="relative inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-brand-navy/10 border border-brand-navy/20 text-xs font-bold text-brand-navy align-super -translate-y-0.5 mx-0.5 hover:bg-brand-navy hover:text-white transition-colors before:content-[''] before:absolute before:-inset-3"
    >
      {n}
    </button>
  );
}

function RichParagraph({ text, segmentMap, onWatch, onVerseClick, className, pKey }) {
  const parts = text.split(new RegExp(CITE_RE.source, "g"));
  return (
    <p className={className}>
      {parts.map((part, i) => {
        if (part && CITE_RE.test(part)) {
          const nums = [...part.matchAll(/\d+/g)].map((m) => m[0]);
          return nums.map((n, j) => (
            <CitationPill
              key={`${pKey}-${i}-${j}`}
              n={n}
              seg={segmentMap?.[n]}
              onWatch={onWatch}
            />
          ));
        }
        return (
          <span key={`${pKey}-${i}`}>
            {renderRich(part, `${pKey}-${i}`, onVerseClick)}
          </span>
        );
      })}
    </p>
  );
}

// ── Verse reveal — same lazy KJV/NLT fetch pattern as VerseExplorer ─────────
function VerseReveal({ reference, translation, data, onSwitchTranslation }) {
  return (
    <div className="mt-3 rounded-r-2xl rounded-l-md border border-brand-navy/10 border-l-[3px] border-l-brand-navy bg-gradient-to-br from-brand-sky/60 to-white px-4 sm:px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-brand-navy">{reference}</p>
        <span className="flex rounded-full border border-brand-navy/15 p-0.5 flex-shrink-0">
          {TRANSLATIONS.map((tr) => (
            <button
              key={tr}
              type="button"
              onClick={() => onSwitchTranslation(tr)}
              className={`relative rounded-full px-2.5 py-1 text-xs font-bold transition-colors before:content-[''] before:absolute before:-inset-3 ${
                translation === tr
                  ? "bg-brand-navy text-white"
                  : "text-brand-gray hover:text-brand-navy"
              }`}
            >
              {tr}
            </button>
          ))}
        </span>
      </div>
      {data?.loading && (
        <span className="mt-2 flex items-center gap-2 text-sm text-brand-gray">
          <Loader2 className="w-3.5 h-3.5 motion-safe:animate-spin" />
          Loading verse…
        </span>
      )}
      {data?.error && (
        <p className="mt-2 text-sm text-brand-gray italic">
          Couldn&apos;t load this verse right now.
        </p>
      )}
      {data?.verses && (
        <p className="mt-2 text-base leading-relaxed text-brand-ink">
          {data.verses.map((v) => (
            <span key={v.number}>
              <sup className="text-brand-navy/50 font-bold mr-1">{v.number}</sup>
              {v.text}{" "}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

// ── Source card — used by the inline rail and the side rail ──────────────────
function SourceCard({ n, seg, blockId, highlighted, onWatch, idPrefix = "src", className = "" }) {
  return (
    <div
      id={`${idPrefix}-${blockId}-${n}`}
      className={`rounded-2xl border bg-white overflow-hidden transition-[border-color,box-shadow] duration-500 ${
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
            <span className="w-10 h-10 rounded-full bg-white/95 text-brand-navy flex items-center justify-center opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-[transform,opacity]">
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

export default function AskPage() {
  const [input, setInput] = useState("");
  const [studies, setStudies] = useState([]); // newest study first; blocks oldest-first
  const [activeId, setActiveId] = useState(null);
  const [openId, setOpenId] = useState(null); // expanded question in the thread
  const [railExpanded, setRailExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const [toast, setToast] = useState(null);
  const [watching, setWatching] = useState(null); // segment currently open in the video modal
  const [studiesOpen, setStudiesOpen] = useState(false); // mobile "Studies" bottom sheet
  const [openVerse, setOpenVerse] = useState(null); // { blockId, ref } | null
  const [verseTranslation, setVerseTranslation] = useState({}); // ref -> "KJV" | "NLT"
  const [verseData, setVerseData] = useState({}); // `${ref}|${translation}` -> {loading}|{verses,translation}|{error}
  const inputRef = useRef(null);
  const studiesCloseRef = useRef(null);
  const toastTimer = useRef(null);
  const keyboardInset = useKeyboardInset();

  // Pick 3 random suggestions each mount so the empty state feels fresh.
  const shownSuggested = useMemo(() => {
    const arr = [...SUGGESTED];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 3);
  }, []);

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
    studiesCloseRef.current?.focus();
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

  // Auto-grow the composer as a follow-up question wraps (capped by max-h).
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

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

  // ── Verse reveal — lazy-fetch KJV/NLT text for a clicked scripture ─────────
  const loadVerse = async (ref, translation) => {
    const key = `${ref}|${translation}`;
    setVerseData((v) => ({ ...v, [key]: { loading: true } }));
    const parsed = parseReference(ref);
    const passage = parsed ? await fetchPassage(parsed, translation) : null;
    setVerseData((v) => ({
      ...v,
      [key]: passage
        ? { verses: passage.verses, translation: passage.translation }
        : { error: true },
    }));
  };

  const toggleVerse = (blockId, ref) => {
    if (openVerse?.blockId === blockId && openVerse?.ref === ref) {
      setOpenVerse(null);
      return;
    }
    setOpenVerse({ blockId, ref });
    const t = verseTranslation[ref] || "KJV";
    if (!verseData[`${ref}|${t}`]) loadVerse(ref, t);
  };

  const switchVerseTranslation = (ref, translation) => {
    setVerseTranslation((vt) => ({ ...vt, [ref]: translation }));
    if (!verseData[`${ref}|${translation}`]) loadVerse(ref, translation);
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
    <main id="main-content" className="h-dvh bg-white flex flex-col lg:grid lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_304px]">
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
      <section className="flex flex-col min-h-0 min-w-0 flex-1" inert={studiesOpen ? "" : undefined}>
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 sm:px-6 py-2.5 border-b border-brand-navy/10 flex-shrink-0 bg-white">
          <NavHamburger className="lg:hidden" />
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
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative" aria-live="polite" aria-atomic="false">
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
                  {shownSuggested.map((s) => (
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
                const hasSources = sources.length > 0;
                const scriptures =
                  b.status === "done" && hasSources ? extractScriptures(b.answer) : [];

                return (
                  <article key={b.id} id={`block-${b.id}`} className="scroll-mt-3 mb-8 pt-3">
                    {/* Question */}
                    <div className="flex justify-end">
                      <p className="text-sm sm:text-base font-medium text-white bg-brand-navy rounded-[20px] rounded-br-[4px] px-4 sm:px-5 py-2.5 max-w-[85%] leading-snug">
                        {b.question}
                      </p>
                    </div>

                    {/* Searching state */}
                    {b.status === "searching" && (
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
                        <span className="text-sm font-medium">
                          Searching every message…
                        </span>
                      </div>
                    )}

                    {/* Answer */}
                    {paras.length > 0 && hasSources && b.status !== "error" && (
                      <div className="mt-6 space-y-4 text-base leading-[1.78] text-brand-ink/90">
                        {paras.map((para, pi) => (
                          <RichParagraph
                            key={pi}
                            text={para}
                            segmentMap={b.segmentMap}
                            onWatch={setWatching}
                            onVerseClick={(ref) => toggleVerse(b.id, ref)}
                            pKey={`${b.id}-${pi}`}
                          />
                        ))}
                      </div>
                    )}

                    {/* Cited moments — mobile/tablet (the xl side rail is hidden
                        below xl, so the videos have to live inline here or the
                        "moments to watch" promise vanishes on a phone) */}
                    {hasSources && b.status !== "error" && (
                      <div className="xl:hidden mt-7">
                        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-gray mb-3">
                          <Quote size={12} className="text-brand-navy" />
                          Heard in these moments · {sources.length}
                        </p>
                        <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {sources.map(([n, seg]) => (
                            <SourceCard
                              key={n}
                              n={n}
                              seg={seg}
                              blockId={b.id}
                              onWatch={setWatching}
                              idPrefix="srcm"
                              className="w-60 flex-shrink-0 snap-start"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No sources (honest refusal) or error */}
                    {b.answer && !hasSources && (
                      <div
                        className="mt-6 rounded-2xl border border-brand-navy/10 bg-brand-light px-5 py-4"
                        {...(b.status === "error" ? { role: "alert" } : {})}
                      >
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
                          {scriptures.map((v) => {
                            const active =
                              openVerse?.blockId === b.id && openVerse?.ref === v;
                            return (
                              <button
                                key={v}
                                type="button"
                                onClick={() => toggleVerse(b.id, v)}
                                aria-expanded={active}
                                className={`inline-flex items-center gap-1.5 text-xs font-bold rounded-full border px-3.5 py-1.5 transition-colors ${
                                  active
                                    ? "bg-brand-navy text-white border-brand-navy"
                                    : "text-brand-navy bg-brand-sky border-brand-navy/10 hover:border-brand-navy/40"
                                }`}
                              >
                                <BookOpen size={12} />
                                {v}
                              </button>
                            );
                          })}
                        </div>
                        {openVerse?.blockId === b.id && (
                          <VerseReveal
                            reference={openVerse.ref}
                            translation={verseTranslation[openVerse.ref] || "KJV"}
                            data={
                              verseData[
                                `${openVerse.ref}|${verseTranslation[openVerse.ref] || "KJV"}`
                              ]
                            }
                            onSwitchTranslation={(tr) =>
                              switchVerseTranslation(openVerse.ref, tr)
                            }
                          />
                        )}
                      </div>
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
            <div className="flex items-end gap-2 bg-brand-light rounded-2xl border border-brand-navy/15 focus-within:border-brand-navy/40 shadow-sm p-1.5 pl-4 transition-colors">
              <Sparkles size={17} className="text-brand-navy/50 flex-shrink-0 mb-2.5" />
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask();
                  }
                }}
                placeholder={
                  hasBlocks
                    ? "Ask a follow-up — it stays in this study…"
                    : "Ask anything across every message…"
                }
                className="flex-1 bg-transparent py-2 text-base text-brand-ink placeholder:text-brand-gray/60 focus:outline-none resize-none min-w-0 max-h-[120px] leading-relaxed"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Ask"
                className="w-10 h-10 rounded-[10px] bg-brand-navy text-white flex items-center justify-center flex-shrink-0 hover:bg-brand-deep active:scale-[0.96] transition-[transform,background-color] disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 size={17} className="motion-safe:animate-spin" />
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
            ref={studiesCloseRef}
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
