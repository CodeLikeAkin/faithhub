"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Sparkles,
  ArrowUp,
  Play,
  Loader2,
  Quote,
  BookMarked,
  ArrowUpRight,
} from "lucide-react";

/**
 * Ask the Word — global, cross-corpus search.
 *
 * One question, answered from across every one of Rev. Peter's messages, with
 * the exact moments to watch. Deliberately NOT the series-chat bubble UI: this
 * is an "editorial answer" layout — each ask becomes a block with a grounded
 * answer (inline citation pills) and a numbered "Heard in these moments" rail.
 * Clicking a citation flies you to its source card.
 */

const SUGGESTED = [
  "What does Rev. Peter teach about walking in faith when nothing has changed yet?",
  "How does Rev. Peter teach that the eternal life God has given us can never be taken away?",
  "How should a believer deal with unbelief in prayer?",
  "What is the believer's righteousness in Christ?",
  "How do I recognise the leading of the Holy Spirit?",
  "Why does Rev. Peter emphasise the local church so much?",
];

const yt = (v, t) => `https://youtube.com/watch?v=${v}&t=${t}s`;

// ── Inline answer renderer: paragraphs, **bold**, and [N] citation pills ──────
function CitationPill({ n, blockId, onJump }) {
  return (
    <button
      onClick={() => onJump(n)}
      className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-brand-navy/10 border border-brand-navy/20 text-[10px] font-bold text-brand-navy align-super -translate-y-0.5 mx-0.5 hover:bg-brand-navy hover:text-white transition-colors"
      title="Jump to this source"
    >
      {n}
    </button>
  );
}

function renderBold(text, keyBase) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) => {
    if (/^\*\*[^*]+\*\*$/.test(chunk)) {
      return (
        <strong key={`${keyBase}-b${i}`} className="font-bold text-brand-ink">
          {chunk.slice(2, -2)}
        </strong>
      );
    }
    return chunk;
  });
}

function AnswerBody({ text, blockId, onJump }) {
  if (!text) return null;
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());

  const citeRe = /(\[\d+\](?:\s*\[\d+\])*|\[\d+(?:,\s*\d+)+\])/;

  return (
    <div className="space-y-4 text-[15.5px] leading-[1.75] text-brand-ink/90">
      {paragraphs.map((para, pi) => {
        // Split each paragraph on citation groups, keeping the groups.
        const parts = para.split(new RegExp(citeRe.source, "g"));
        return (
          <p key={pi}>
            {parts.map((part, i) => {
              if (part && citeRe.test(part)) {
                const nums = [...part.matchAll(/\d+/g)].map((m) => m[0]);
                return nums.map((n, j) => (
                  <CitationPill
                    key={`${pi}-${i}-${j}`}
                    n={n}
                    blockId={blockId}
                    onJump={onJump}
                  />
                ));
              }
              return (
                <span key={`${pi}-${i}`}>{renderBold(part, `${pi}-${i}`)}</span>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}

// ── Source card ──────────────────────────────────────────────────────────────
function SourceCard({ n, seg, blockId, highlighted }) {
  return (
    <div
      id={`src-${blockId}-${n}`}
      className={`flex gap-3 rounded-2xl border bg-white p-3.5 transition-all duration-500 ${
        highlighted
          ? "border-brand-navy ring-2 ring-brand-navy/30 shadow-lg shadow-brand-navy/10"
          : "border-brand-navy/10"
      }`}
    >
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-navy text-white text-[11px] font-bold flex items-center justify-center">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        {seg.video_id && (
          <div className="relative w-full aspect-video rounded-lg overflow-hidden mb-2.5 bg-brand-sky">
            <img
              src={`https://img.youtube.com/vi/${seg.video_id}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <p className="text-xs font-bold text-brand-ink leading-snug line-clamp-2">
          {seg.sermon_title}
        </p>
        <p className="mt-1.5 text-[12.5px] italic text-brand-gray leading-relaxed line-clamp-4">
          &ldquo;{seg.text}&rdquo;
        </p>
        <div className="mt-2.5 flex items-center gap-3">
          {seg.video_id && (
            <a
              href={yt(seg.video_id, seg.start_seconds)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-brand-navy hover:underline"
            >
              <Play size={10} fill="currentColor" />
              Watch this moment
            </a>
          )}
          {seg.sermon_id && (
            <Link
              href={`/sermon/${seg.sermon_id}`}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-gray hover:text-brand-navy"
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
  const [blocks, setBlocks] = useState([]); // newest first
  const [busy, setBusy] = useState(false);
  const [highlight, setHighlight] = useState(null); // `${blockId}-${n}`
  const inputRef = useRef(null);

  const jumpToSource = (blockId, n) => {
    const el = document.getElementById(`src-${blockId}-${n}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlight(`${blockId}-${n}`);
    setTimeout(() => setHighlight(null), 2200);
  };

  const ask = async (question) => {
    const q = (question ?? input).trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);

    const blockId = Date.now();
    setBlocks((prev) => [
      { id: blockId, question: q, answer: "", segmentMap: {}, suggestions: [], status: "searching" },
      ...prev,
    ]);

    const patch = (fields) =>
      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, ...fields } : b))
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
    }
  };

  const hasAsked = blocks.length > 0;

  return (
    <main className="min-h-screen bg-white">
      {/* Ambient sky wash at the top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-brand-sky/70 to-transparent -z-0" />

      {/* Minimal home link (global nav is hidden on this immersive view) */}
      <Link
        href="/"
        className="fixed top-4 left-4 sm:top-5 sm:left-6 z-40 flex items-center bg-white/95 backdrop-blur-md border border-brand-navy/10 shadow-lg shadow-brand-navy/5 rounded-full pl-3 pr-4 py-2 hover:bg-brand-sky transition-colors"
      >
        <Image
          src="/hofng-logo.png"
          alt="Heritage of Faith — Home"
          width={100}
          height={32}
          className="h-7 w-auto object-contain"
          priority
        />
      </Link>

      <section
        className={`relative mx-auto max-w-3xl px-4 sm:px-6 ${
          hasAsked ? "pt-24 sm:pt-28" : "pt-32 sm:pt-44"
        }`}
      >
        {/* Hero copy — only before the first ask */}
        {!hasAsked && (
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-brand-navy/10 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-navy">
              <Sparkles size={13} />
              Ask · every message
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl font-bold text-brand-ink tracking-tight leading-[1.05]">
              Ask the Word.
            </h1>
            <p className="mt-4 text-brand-gray text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              One question, answered from everything Rev. Peter has taught —
              grounded in his exact words, with the moments to watch.
            </p>
          </div>
        )}

        {/* Search field */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
          className={`sticky top-4 z-30 ${hasAsked ? "mb-10" : ""}`}
        >
          <div className="flex items-center gap-2 bg-white rounded-2xl border border-brand-navy/15 shadow-xl shadow-brand-navy/10 p-2 pl-5">
            <Sparkles size={18} className="text-brand-navy/50 flex-shrink-0" />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything across every message…"
              className="flex-1 bg-transparent py-2.5 text-base sm:text-[15px] text-brand-ink placeholder:text-brand-gray/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Ask"
              className="w-11 h-11 rounded-xl bg-brand-navy text-white flex items-center justify-center flex-shrink-0 hover:bg-brand-deep transition-colors disabled:opacity-40"
            >
              {busy ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <ArrowUp size={18} />
              )}
            </button>
          </div>
        </form>

        {/* Suggested questions — only before the first ask */}
        {!hasAsked && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {SUGGESTED.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="text-left text-[13px] font-medium text-brand-navy bg-white border border-brand-navy/10 rounded-full px-4 py-2 hover:bg-brand-sky hover:border-brand-navy/25 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Answer blocks */}
      <section className="relative mx-auto max-w-3xl px-4 sm:px-6 pb-24">
        {blocks.map((b) => {
          const sources = Object.entries(b.segmentMap || {});
          return (
            <article
              key={b.id}
              className="mb-14 pb-14 border-b border-brand-navy/10 last:border-0"
            >
              {/* Question */}
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-navy/60 mb-2">
                You asked
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-brand-ink tracking-tight leading-tight">
                {b.question}
              </h2>

              {/* Searching state */}
              {b.status === "searching" && (
                <div className="mt-6 flex items-center gap-3 text-brand-gray">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-2 h-2 rounded-full bg-brand-navy/40 animate-pulse"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </span>
                  <span className="text-sm font-medium">
                    Searching every message…
                  </span>
                </div>
              )}

              {/* Answer card */}
              {(b.answer || b.status === "answering") && (
                <div className="mt-6 rounded-3xl border border-brand-navy/10 bg-gradient-to-b from-brand-sky/40 to-white p-5 sm:p-7">
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="w-8 h-8 rounded-xl bg-brand-navy text-white flex items-center justify-center">
                      <BookMarked size={16} />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-brand-navy">
                      What Rev. Peter teaches
                    </span>
                    {b.status === "answering" && (
                      <Loader2
                        size={13}
                        className="text-brand-navy/40 animate-spin ml-auto"
                      />
                    )}
                  </div>
                  <AnswerBody
                    text={b.answer}
                    blockId={b.id}
                    onJump={(n) => jumpToSource(b.id, n)}
                  />
                </div>
              )}

              {/* Sources */}
              {sources.length > 0 && (
                <div className="mt-6">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-gray mb-3">
                    <Quote size={13} className="text-brand-navy" />
                    Heard in these moments · {sources.length}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {sources.map(([n, seg]) => (
                      <SourceCard
                        key={n}
                        n={n}
                        seg={seg}
                        blockId={b.id}
                        highlighted={highlight === `${b.id}-${n}`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-up suggestions */}
              {b.status === "done" && b.suggestions?.length > 0 && (
                <div className="mt-7">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-gray mb-3">
                    Keep exploring
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {b.suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => ask(s)}
                        className="text-left text-[13px] font-medium text-brand-navy bg-white border border-brand-navy/10 rounded-full px-4 py-2 hover:bg-brand-sky hover:border-brand-navy/25 transition-colors"
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
      </section>
    </main>
  );
}
