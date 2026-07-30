"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Home,
  Sparkles,
  Flame,
  BookOpen,
  ScrollText,
  X,
} from "lucide-react";

const FEATURES = [
  { name: "Home",          href: "/",            icon: Home       },
  { name: "Ask the Word",  href: "/ask",         icon: Sparkles   },
  { name: "Declarations",  href: "/declarations", icon: Flame      },
  { name: "Series Study",  href: "/series",      icon: BookOpen   },
  { name: "The Word",      href: "/word",        icon: ScrollText },
];

function isActive(href, pathname) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function NavPill() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Mirror the exact condition Navbar uses to hide itself
  const visible =
    pathname === "/declarations" ||
    pathname === "/ask" ||
    /^\/series\/.+/.test(pathname) ||
    /^\/sermon\/.+/.test(pathname);

  if (!visible) return null;

  return (
    <>
      {/* Tap-away scrim */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Container — hidden on large screens where each page has its own chrome */}
      <div className="fixed bottom-6 left-4 z-50 flex flex-col items-start gap-2.5">
        {/* Feature card */}
        <div
          aria-hidden={!open}
          className={`bg-white rounded-2xl border border-brand-navy/10 shadow-2xl shadow-brand-navy/15 overflow-hidden w-52 origin-bottom-left transition-all duration-200 ${
            open
              ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
              : "opacity-0 scale-95 translate-y-1 pointer-events-none"
          }`}
        >
          {/* Accent stripe */}
          <div className="h-[3px] bg-brand-navy" />

          {FEATURES.map(({ name, href, icon: Icon }) => {
            const active = isActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`group flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-sky text-brand-navy font-bold shadow-[inset_3px_0_0_#173A68]"
                    : "text-brand-ink hover:bg-brand-sky/50 hover:text-brand-navy"
                }`}
              >
                <Icon
                  size={15}
                  className={`flex-shrink-0 transition-colors ${
                    active
                      ? "text-brand-navy"
                      : "text-brand-gray group-hover:text-brand-navy"
                  }`}
                />
                {name}
              </Link>
            );
          })}
        </div>

        {/* Trigger button */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close navigation" : "Navigate to another section"}
          aria-expanded={open}
          aria-haspopup="true"
          className="w-11 h-11 rounded-full bg-brand-navy text-white flex items-center justify-center shadow-lg shadow-brand-navy/30 hover:bg-brand-deep active:scale-[0.92] transition-[transform,background-color] duration-150"
        >
          <span
            className={`transition-transform duration-200 ${open ? "rotate-90" : "rotate-0"}`}
          >
            {open ? <X size={18} /> : <LayoutGrid size={18} />}
          </span>
        </button>
      </div>
    </>
  );
}
