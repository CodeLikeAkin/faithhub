"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { parseSermonDate, partTitle } from "@/lib/titles";
import { cn } from "@/lib/utils";

export const partDate = (p, opts = { month: "short", day: "numeric", year: "numeric" }) => {
  const d = parseSermonDate(p?.title) || (p?.sermon_date ? new Date(p.sermon_date) : null);
  return d ? d.toLocaleDateString("en-US", { ...opts, timeZone: "UTC" }) : "";
};

const WINDOW = 5; // parts shown around the current one before "All N parts"

/**
 * The series as a numbered course: where you are, what's next, one tap to
 * move. Parts switch in place (the lesson keeps its Ask thread).
 */
export default function CourseOutline({ series, parts, activeId, onSelect, className }) {
  const [showAll, setShowAll] = useState(false);
  const [openMobile, setOpenMobile] = useState(false);

  const idx = Math.max(0, parts.findIndex((p) => p.id === activeId));
  const prev = parts[idx - 1] || null;
  const next = parts[idx + 1] || null;
  const start = Math.min(Math.max(0, idx - 2), Math.max(0, parts.length - WINDOW));
  const visible = showAll ? parts : parts.slice(start, start + WINDOW);

  const stepButton = (part, dir) => {
    const Icon = dir < 0 ? ChevronLeft : ChevronRight;
    const label = dir < 0 ? "Previous" : "Next";
    return (
      <button
        type="button"
        onClick={() => part && onSelect(part.id)}
        disabled={!part}
        aria-label={part ? `${label}: Part ${part.part_number}, ${partTitle(part.title, series.title)}` : `${label} part`}
        className={cn(
          "inline-flex h-10 items-center gap-1 rounded-full text-sm font-semibold transition-colors disabled:opacity-35",
          dir < 0
            ? "border border-brand-navy/15 px-2.5 text-brand-navy hover:bg-brand-sky sm:pl-2.5 sm:pr-4"
            : "bg-brand-navy px-2.5 text-white hover:bg-brand-deep disabled:bg-brand-navy/40 sm:pl-4 sm:pr-2.5"
        )}
      >
        {dir < 0 && <Icon size={17} aria-hidden="true" />}
        <span className="hidden sm:inline">{dir < 0 ? "Previous" : "Next part"}</span>
        {dir > 0 && <Icon size={17} aria-hidden="true" />}
      </button>
    );
  };

  return (
    <nav
      aria-label={`${series.title}: parts`}
      className={cn(
        "overflow-hidden rounded-[1.5rem] border border-brand-navy/10 bg-white shadow-[0_24px_50px_-40px_rgba(23,58,104,0.45)]",
        className
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-brand-gray">
            Part {parts[idx]?.part_number} of {parts.length}
          </p>
          <Link
            href={`/series/${series.id}`}
            className="block truncate font-display text-lg font-medium text-brand-ink hover:text-brand-navy"
          >
            {series.title}
          </Link>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {stepButton(prev, -1)}
          {stepButton(next, 1)}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpenMobile((o) => !o)}
        aria-expanded={openMobile}
        className="flex w-full items-center justify-between border-t border-brand-navy/10 px-4 py-3 text-sm font-semibold text-brand-navy sm:hidden"
      >
        {openMobile ? "Hide the parts" : `All ${parts.length} parts`}
        <ChevronDown size={16} aria-hidden="true" className={cn("transition-transform", openMobile && "rotate-180")} />
      </button>

      <div className={cn("border-t border-brand-navy/10", openMobile ? "block" : "hidden sm:block")}>
        <ol className="py-1.5">
          {(openMobile ? parts : visible).map((p) => {
            const current = p.id === activeId;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors sm:px-5",
                    current ? "bg-brand-sky/70" : "hover:bg-brand-sky/40"
                  )}
                >
                  <span
                    className={cn(
                      "grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums",
                      current ? "bg-brand-navy text-white" : "border border-brand-navy/20 text-brand-navy"
                    )}
                  >
                    {p.part_number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm", current ? "font-semibold text-brand-ink" : "text-brand-ink/85")}>
                      {partTitle(p.title, series.title)}
                    </span>
                    {partDate(p) && <span className="block text-xs text-brand-gray">{partDate(p)}</span>}
                  </span>
                  {current && (
                    <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-brand-navy px-2.5 py-1 text-xs font-bold text-white">
                      <Play size={10} fill="currentColor" aria-hidden="true" />
                      <span className="hidden sm:inline">Now playing</span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
        {parts.length > WINDOW && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="hidden w-full border-t border-brand-navy/10 px-5 py-3 text-left text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-sky/40 sm:block"
          >
            {showAll ? "Show fewer parts" : `All ${parts.length} parts`}
          </button>
        )}
      </div>
    </nav>
  );
}
