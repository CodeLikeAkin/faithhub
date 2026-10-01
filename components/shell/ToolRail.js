"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BookMarked,
  BookOpen,
  Compass,
  Flame,
  Home,
  MessageSquareHeart,
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
import { Rings } from "@/components/Decor";

/** Every section of the app, in rail order. The mobile drawer uses the same list. */
export const TOOLS = [
  { name: "Home", short: "Home", href: "/", icon: Home, match: (p) => p === "/" },
  { name: "Ask the Word", short: "Ask", href: "/ask", icon: Sparkles, match: (p) => p === "/ask" },
  {
    name: "Series Study",
    short: "Series",
    href: "/series",
    icon: BookOpen,
    match: (p) => p === "/series" || p.startsWith("/series/") || p.startsWith("/sermon/"),
  },
  { name: "Declarations", short: "Declare", href: "/declarations", icon: Flame, match: (p) => p.startsWith("/declarations") },
  { name: "The Word", short: "Word", href: "/word", icon: ScrollText, match: (p) => p.startsWith("/word") },
];

/** The two pages about FaithHub itself; they sit at the foot of the rail. */
const ABOUT_LINKS = [
  { name: "Vision", href: "/vision", icon: Compass, match: (p) => p.startsWith("/vision") },
  { name: "About & feedback", href: "/about", icon: MessageSquareHeart, match: (p) => p.startsWith("/about") },
];

// Class sets per rail mode. Written out in full (not assembled from
// fragments) so Tailwind's scanner sees every class.
//   expanded  — labels + studies
//   collapsed — icon strip
//   auto      — icon strip below 2xl, expanded from 2xl (lesson pages)
const SHOW_FLEX = { expanded: "flex", collapsed: "hidden", auto: "hidden 2xl:flex" };
const SHOW_BLOCK = { expanded: "block", collapsed: "hidden", auto: "hidden 2xl:block" };
const ONLY_COLLAPSED_FLEX = { expanded: "hidden", collapsed: "flex", auto: "flex 2xl:hidden" };
// The icons sit at the same left position whichever way the rail is showing —
// they never jump. Each label lives to their right and fades + collapses to
// zero width in sync with the rail, so collapse/expand reads as one motion.
const LABEL = {
  expanded: "max-w-[10rem] opacity-100",
  collapsed: "max-w-0 opacity-0",
  auto: "max-w-0 opacity-0 2xl:max-w-[10rem] 2xl:opacity-100",
};

function RailLink({ link, mode, pathname, onNavigate, compact = false }) {
  const { name, href, icon: Icon, match } = link;
  const active = match(pathname);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={name}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
        compact ? "h-9" : "h-10",
        active ? "bg-white/[0.14] text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
      )}
    >
      <Icon size={18} aria-hidden="true" className="flex-shrink-0" />
      <span className={cn("overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out", LABEL[mode])}>
        {name}
      </span>
    </Link>
  );
}

/**
 * The app's left rail, in the deep navy admin also uses: logo, every section, the reader's
 * saved studies (the active one unfolds into its question outline), and the
 * Vision / About pages at its foot.
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
  // Extra links after the tools — lets a page outside the tool shell reuse
  // this rail — and an optional call to action under the footer links.
  trailingLinks = [],
  footerCta = null,
}) {
  const pathname = usePathname() || "";
  const { studies } = useStudies();
  const recent = byRecent(studies);
  const navLinks = [...TOOLS, ...trailingLinks];

  return (
    <div className="relative isolate flex h-full min-h-0 flex-col overflow-hidden text-white">
      {/* Admin's rings, behind everything. Anchored to the left edge so they
          don't slide as the rail widens; off on the icon strip, where they'd
          only show as a cropped sliver. */}
      <Rings
        className={cn(
          "pointer-events-none absolute -bottom-40 -left-40 -z-10 h-[28rem] w-[28rem] text-white/[0.05]",
          SHOW_BLOCK[mode]
        )}
      />
      <div className="flex h-16 flex-shrink-0 items-center gap-2 pl-5 pr-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex min-w-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Image
            src="/hofng-logo-white.png"
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
              "ml-auto h-9 w-9 flex-shrink-0 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white",
              { expanded: "grid", collapsed: "hidden", auto: "hidden 2xl:grid" }[mode]
            )}
          >
            <PanelLeftClose size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      <nav aria-label="Sections" className="flex-shrink-0 px-3">
        <ul className="space-y-0.5">
          {navLinks.map((link) => (
            <li key={link.href}>
              <RailLink link={link} mode={mode} pathname={pathname} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </nav>

      {/* Studies — expanded rail */}
      <div className={cn("mt-7 min-h-0 flex-1 flex-col", SHOW_FLEX[mode])}>
        <div className="flex items-center justify-between px-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">Your studies</h2>
          <Link
            href="/ask?new=1"
            onClick={onNavigate}
            aria-label="New study"
            title="New study"
            className="grid h-8 w-8 place-items-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
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
                      active ? "bg-white/[0.14]" : "hover:bg-white/10"
                    )}
                  >
                    <span className="block truncate text-sm font-medium text-white">{s.title}</span>
                    <span className="block truncate text-xs text-white/55">
                      {displayTitle(s.context?.seriesTitle || s.context?.sermonTitle) || "Everything"} · {fmtDate(s.updatedAt)}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => onDeleteStudy(s.id)}
                    aria-label={`Delete study: ${s.title}`}
                    className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-white/60 opacity-0 transition-opacity hover:bg-white/10 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>

                {/* The open study's outline — every question is a jump link. */}
                {active && onJumpToBlock && s.blocks.length > 1 && (
                  <ol aria-label="Questions in this study" className="mb-2 ml-4 mt-1.5 border-l border-white/20 pl-2">
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
                              current ? "font-medium text-white" : "text-white/70 hover:text-white"
                            )}
                          >
                            <span className={cn("flex-shrink-0 text-xs font-bold tabular-nums", current ? "text-white" : "text-white/50")}>
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
            <li className="px-3 py-1 text-sm leading-relaxed text-white/60">Questions you ask are kept here, on this device.</li>
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
            className="grid h-10 w-10 place-items-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <BookMarked size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Foot: Vision and About, in both modes; expand control on the icon strip */}
      <div className="flex-shrink-0 border-t border-white/10 px-3 py-2">
        <ul className="space-y-0.5">
          {ABOUT_LINKS.map((link) => (
            <li key={link.href}>
              <RailLink link={link} mode={mode} pathname={pathname} onNavigate={onNavigate} compact />
            </li>
          ))}
          {onToggleCollapse && (
            <li className={ONLY_COLLAPSED_FLEX[mode]}>
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className="flex h-9 items-center gap-3 rounded-xl px-3 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <PanelLeftOpen size={18} aria-hidden="true" />
              </button>
            </li>
          )}
        </ul>
        {footerCta}
      </div>
    </div>
  );
}
