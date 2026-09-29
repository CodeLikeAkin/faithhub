"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A titled horizontal row of cards: swipe or use the arrows; snaps to a card
 * edge and fades the right edge while there is more to see.
 * `itemClassName` sets each card's width (the shelf is a column-flow grid).
 */
export default function Shelf({ eyebrow, title, action, children, className, columns = "grid-flow-col auto-cols-[72%] sm:auto-cols-[16rem]" }) {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth - 2;
    setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft >= max });
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, children]);

  const page = (dir) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  const arrow =
    "grid h-9 w-9 place-items-center rounded-full border border-brand-navy/15 bg-white text-brand-ink transition hover:border-brand-navy hover:text-brand-navy active:scale-95 disabled:pointer-events-none disabled:opacity-35";

  return (
    <section className={className}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-gray">{eyebrow}</p>}
          <h2 className="mt-1 font-display text-2xl font-medium tracking-tight text-brand-ink">{title}</h2>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {action}
          <div className="hidden gap-1.5 sm:flex">
            <button type="button" onClick={() => page(-1)} disabled={edge.start} aria-label="Scroll back" className={arrow}>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => page(1)} disabled={edge.end} aria-label="Scroll forward" className={arrow}>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      <div className="relative">
        <div
          ref={ref}
          onScroll={measure}
          className={cn("fh-no-scrollbar grid snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1", columns)}
        >
          {children}
        </div>
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-white to-transparent transition-opacity duration-300",
            edge.end ? "opacity-0" : "opacity-100"
          )}
        />
      </div>
    </section>
  );
}
