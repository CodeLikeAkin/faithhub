"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { afterLayout, scrollToElement } from "@/lib/scroll";
import { cn } from "@/lib/utils";
import AnswerBlock from "./AnswerBlock";

/**
 * A study as one continuous document: every question stays expanded and
 * stacks under the last, each laid out as a research brief. Owns its scroll
 * container — pass `ref` for `scrollToBlock(id)`.
 *
 * Scroll behaviour carried over from the old Ask page:
 *   - a new question scrolls to the top of the container (absolute target,
 *     after layout);
 *   - while an answer streams, a min-h-[70vh] spacer reserves the room that
 *     scroll needs (scrollTo clamps to content that exists);
 *   - overflowAnchor:none stops Chrome's scroll anchoring from nudging it.
 */
const StudyDocument = forwardRef(function StudyDocument(
  { study, density = "page", busy, onCite, onAsk, onRetry, onActiveBlockChange, describeMoment, className },
  ref
) {
  const scrollRef = useRef(null);
  const blocks = study?.blocks || [];
  const last = blocks[blocks.length - 1];
  const streaming = last?.status === "searching" || last?.status === "answering";

  const scrollToBlock = (id, smooth = true) => {
    const el = document.getElementById(`q-${id}`);
    if (el) scrollToElement(el, { offset: 16, smooth });
  };
  useImperativeHandle(ref, () => ({ scrollToBlock }), []);

  // Opening a study: land on the #q- anchor if there is one, else on the
  // latest question (continuing where the reader left off).
  const lastId = last?.id;
  const seenLast = useRef(null);
  useEffect(() => {
    if (seenLast.current === null) {
      seenLast.current = lastId ?? 0;
      const hash = typeof window !== "undefined" ? window.location.hash.match(/^#q-(\d+)$/) : null;
      const target = hash && blocks.some((b) => String(b.id) === hash[1]) ? hash[1] : blocks.length > 1 ? lastId : null;
      if (target) afterLayout(() => scrollToBlock(target, false));
      return;
    }
    // A newly asked question → bring it to the top once its headroom exists.
    if (lastId && lastId !== seenLast.current && last?.status === "searching") {
      afterLayout(() => scrollToBlock(lastId));
    }
    seenLast.current = lastId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId]);

  // Scroll-spy for the outline: the question whose section is under the top
  // quarter of the viewport is the "current" one. Keyed on the block ids, not
  // the blocks array, so a streaming answer doesn't re-subscribe every chunk.
  const activeRef = useRef(null);
  const idsKey = blocks.map((b) => b.id).join(",");
  useEffect(() => {
    const c = scrollRef.current;
    if (!c || !onActiveBlockChange) return;
    const ids = idsKey ? idsKey.split(",") : [];
    let frame = 0;
    const measure = () => {
      frame = 0;
      const cTop = c.getBoundingClientRect().top;
      const line = c.clientHeight * 0.25;
      let current = ids[0] ?? null;
      for (const id of ids) {
        const el = document.getElementById(`q-${id}`);
        if (el && el.getBoundingClientRect().top - cTop <= line) current = id;
      }
      if (current !== activeRef.current) {
        activeRef.current = current;
        onActiveBlockChange(current);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    c.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      c.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [idsKey, onActiveBlockChange]);

  const page = density === "page";

  return (
    <div
      ref={scrollRef}
      className={cn("relative min-h-0 flex-1 overflow-y-auto custom-scrollbar", className)}
      style={{ overflowAnchor: "none" }}
    >
      <div className={page ? "mx-auto w-full max-w-5xl px-4 pb-12 pt-8 sm:px-8 sm:pt-12" : "px-5 pb-10 pt-6"}>
        {blocks.map((b, i) => (
          <div
            key={b.id}
            className={cn(i > 0 && (page ? "mt-14 border-t border-brand-navy/10 pt-12 sm:mt-16 sm:pt-14" : "mt-10 border-t border-brand-navy/10 pt-9"))}
          >
            <AnswerBlock
              block={b}
              isLast={i === blocks.length - 1}
              density={density}
              busy={busy}
              onCite={onCite}
              onAsk={onAsk}
              onRetry={onRetry}
              describeMoment={describeMoment}
            />
          </div>
        ))}
        {/* Scroll headroom: right after asking, the new block is only a short
            "searching…" row, so there isn't enough content below it for the
            container to scroll it to the top (scrollTo clamps). This reserves
            the room, and shrinks away once the answer has finished. */}
        {streaming && <div aria-hidden="true" className="min-h-[70vh]" />}
      </div>
    </div>
  );
});

export default StudyDocument;
