"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BookMarked,
  BookOpen,
  Flame,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ScrollText,
  Sparkles,
  Trash2,
} from "lucide-react";
import { fmtDate } from "@/lib/ask-format";
import { displayTitle } from "@/lib/titles";
import { byRecent, useStudies } from "@/lib/studies";
import { cn } from "@/lib/utils";

const TOOLS = [
  { name: "Ask the Word", href: "/ask", icon: Sparkles, match: (p) => p === "/ask" },
  {
    name: "Series Study",
    href: "/series",
    icon: BookOpen,
    match: (p) => p === "/series" || p.startsWith("/series/") || p.startsWith("/sermon/"),
  },
  { name: "Declarations", href: "/declarations", icon: Flame, match: (p) => p.startsWith("/declarations") },
  { name: "The Word", href: "/word", icon: ScrollText, match: (p) => p.startsWith("/word") },
];

// Class sets per rail mode. Written out in full (not assembled from
// fragments) so Tailwind's scanner sees every class.
//   expanded  — labels + studies
//   collapsed — icon strip
//   auto      — icon strip below 2xl, expanded from 2xl (lesson pages)
const SHOW_BLOCK = { expanded: "block", collapsed: "hidden", auto: "hidden 2xl:block" };
const SHOW_FLEX = { expanded: "flex", collapsed: "hidden", auto: "hidden 2xl:flex" };
const SHOW_INLINE = { expanded: "inline", collapsed: "hidden", auto: "hidden 2xl:inline" };
const ONLY_COLLAPSED_FLEX = { expanded: "hidden", collapsed: "flex", auto: "flex 2xl:hidden" };
const ITEM_LAYOUT = {
  expanded: "justify-start px-3",
  collapsed: "justify-center px-0",
  auto: "justify-center px-0 2xl:justify-start 2xl:px-3",
};
const HEADER_LAYOUT = {
  expanded: "justify-start pl-5 pr-3",
  collapsed: "justify-center",
  auto: "justify-center 2xl:justify-start 2xl:pl-5 2xl:pr-3",
};

/**
 * The tool pages' left rail: logo, links between tools, and the user's saved
 * studies. The active study unfolds into its question outline.
 */
export default function ToolRail({
  mode = "expanded",
  onNavigate,
  onToggleCollapse,
  activeStudyId,
  activeBlockId,
  onJumpToBlock,
  onDeleteStudy,
  onOpenStudy,
}) {
  const pathname = usePathname() || "";
  const { studies } = useStudies();
  const recent = byRecent(studies);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("flex h-16 flex-shrink-0 items-center gap-2", HEADER_LAYOUT[mode])}>
        <Link href="/" onClick={onNavigate} className="flex min-w-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy">
          <Image
            src="/hofng-logo.png"
            alt="Heritage of Faith — Home"
            width={208}
            height={146}
            className="h-8 w-auto"
            priority
          />
        </Link>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className={cn(
              "ml-auto h-9 w-9 flex-shrink-0 place-items-center rounded-lg text-brand-gray transition-colors hover:bg-white hover:text-brand-navy",
              { expanded: "grid", collapsed: "hidden", auto: "hidden 2xl:grid" }[mode]
            )}
          >
            <PanelLeftClose size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      <nav aria-label="Tools" className="flex-shrink-0 px-3">
        <ul className="space-y-0.5">
          {TOOLS.map(({ name, href, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  title={name}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-xl text-sm font-medium transition-colors",
                    ITEM_LAYOUT[mode],
                    active
                      ? "bg-white text-brand-navy shadow-sm ring-1 ring-brand-navy/10"
                      : "text-brand-ink/75 hover:bg-white/70 hover:text-brand-navy"
                  )}
                >
                  <Icon size={18} aria-hidden="true" className="flex-shrink-0" />
                  <span className={SHOW_INLINE[mode]}>{name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Studies — expanded rail */}
      <div className={cn("mt-7 min-h-0 flex-1 flex-col", SHOW_FLEX[mode])}>
        <div className="flex items-center justify-between px-5">
          <h2 className="text-sm font-bold text-brand-ink">Your studies</h2>
          <Link
            href="/ask?new=1"
            onClick={onNavigate}
            aria-label="New study"
            title="New study"
            className="grid h-8 w-8 place-items-center rounded-lg text-brand-navy transition-colors hover:bg-white"
          >
            <Plus size={17} aria-hidden="true" />
          </Link>
        </div>
        <ul className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4 custom-scrollbar">
          {recent.map((s) => {
            const active = String(s.id) === String(activeStudyId);
            return (
              <li key={s.id}>
                <div className="group relative">
                  <Link
                    href={`/ask?study=${s.id}`}
                    // A study begun on this page's series or message opens in
                    // its Ask panel instead of navigating away.
                    onClick={(e) => {
                      if (onOpenStudy?.(s)) e.preventDefault();
                      onNavigate?.();
                    }}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-xl py-2 pl-3 pr-9 transition-colors",
                      active ? "bg-white shadow-sm ring-1 ring-brand-navy/10" : "hover:bg-white/70"
                    )}
                  >
                    <span className="block truncate text-sm font-medium text-brand-ink">{s.title}</span>
                    <span className="block truncate text-xs text-brand-gray">
                      {displayTitle(s.context?.seriesTitle || s.context?.sermonTitle) || "Everything"} · {fmtDate(s.updatedAt)}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => onDeleteStudy(s.id)}
                    aria-label={`Delete study: ${s.title}`}
                    className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-brand-gray/70 opacity-0 transition-opacity hover:bg-white hover:text-brand-navy focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>

                {/* The open study's outline — every question is a jump link. */}
                {active && onJumpToBlock && s.blocks.length > 1 && (
                  <ol aria-label="Questions in this study" className="mb-2 ml-4 mt-1.5 border-l border-brand-navy/15 pl-2">
                    {s.blocks.map((b, i) => {
                      const current = String(b.id) === String(activeBlockId);
                      return (
                        <li key={b.id}>
                          <button
                            type="button"
                            onClick={() => {
                              onJumpToBlock(b.id);
                              onNavigate?.();
                            }}
                            aria-current={current ? "location" : undefined}
                            className={cn(
                              "flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left text-sm leading-snug transition-colors",
                              current ? "font-medium text-brand-navy" : "text-brand-ink/70 hover:text-brand-navy"
                            )}
                          >
                            <span className={cn("flex-shrink-0 text-xs font-bold tabular-nums", current ? "text-brand-navy" : "text-brand-gray")}>
                              {i + 1}
                            </span>
                            <span className="line-clamp-2">{b.question}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </li>
            );
          })}
          {!recent.length && (
            <li className="px-3 py-1 text-sm leading-relaxed text-brand-gray">
              Questions you ask are kept here, on this device.
            </li>
          )}
        </ul>
      </div>

      {/* Icon strip extras — collapsed rail */}
      <div className={cn("mt-4 flex-1 flex-col items-center gap-1 px-3", ONLY_COLLAPSED_FLEX[mode])}>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Show your studies"
            title="Your studies"
            className="grid h-10 w-10 place-items-center rounded-xl text-brand-ink/75 transition-colors hover:bg-white hover:text-brand-navy"
          >
            <BookMarked size={18} aria-hidden="true" />
          </button>
        )}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="mt-auto mb-4 grid h-10 w-10 place-items-center rounded-xl text-brand-gray transition-colors hover:bg-white hover:text-brand-navy"
          >
            <PanelLeftOpen size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      <p className={cn("flex-shrink-0 border-t border-brand-navy/10 px-5 py-3 text-xs leading-relaxed text-brand-gray", SHOW_BLOCK[mode])}>
        Answers are grounded in HOF recorded messages. Studies stay on this device.
      </p>
    </div>
  );
}
