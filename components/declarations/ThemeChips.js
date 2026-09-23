"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { THEMES } from "@/lib/declarations";
import { cn } from "@/lib/utils";

const ITEMS = [{ slug: "mine", name: "My declarations", icon: Bookmark }, ...THEMES];

/** A swipeable row of links between My declarations and every theme. */
export default function ThemeChips({ active, className }) {
  const rowRef = useRef(null);

  // Bring the current chip into the row's view (horizontal only).
  useEffect(() => {
    const row = rowRef.current;
    const chip = row?.querySelector('[aria-current="page"]');
    if (row && chip) row.scrollLeft = Math.max(0, chip.offsetLeft - 16);
  }, [active]);

  return (
    <nav aria-label="Declaration themes" className={className}>
      <ul
        ref={rowRef}
        className="relative -mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:-mx-8 sm:px-8 [&::-webkit-scrollbar]:hidden"
      >
        {ITEMS.map(({ slug, name, icon: Icon }) => {
          const current = slug === active;
          return (
            <li key={slug} className="flex-shrink-0">
              <Link
                href={`/declarations/${slug}`}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors",
                  current
                    ? "bg-brand-navy text-white"
                    : "border border-brand-navy/15 text-brand-ink/80 hover:bg-brand-sky hover:text-brand-navy"
                )}
              >
                {Icon && <Icon size={14} fill={current ? "currentColor" : "none"} aria-hidden="true" />}
                {name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
