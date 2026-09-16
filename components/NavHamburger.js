"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Home, Sparkles, Flame, BookOpen, ScrollText, X } from "lucide-react";

const FEATURES = [
  { name: "Home",          href: "/",             icon: Home       },
  { name: "Ask the Word",  href: "/ask",          icon: Sparkles   },
  { name: "Declarations",  href: "/declarations", icon: Flame      },
  { name: "Series Study",  href: "/series",       icon: BookOpen   },
  { name: "The Word",      href: "/word",         icon: ScrollText },
];

function isActive(href, pathname) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function NavHamburger({ className = "" }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 8, left: rect.left });
    }
    setOpen(o => !o);
  };

  return (
    <div className={`flex-shrink-0 ${className}`}>
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Fixed-position dropdown — escapes any overflow:hidden ancestors */}
      {open && (
        <div
          style={{ top: dropPos.top, left: dropPos.left }}
          className="fixed z-50 w-52 bg-white rounded-2xl border border-brand-navy/10 shadow-2xl shadow-brand-navy/15 overflow-hidden animate-in fade-in zoom-in-95 duration-150 origin-top-left"
        >
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
                    active ? "text-brand-navy" : "text-brand-gray group-hover:text-brand-navy"
                  }`}
                />
                {name}
              </Link>
            );
          })}
        </div>
      )}

      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={open ? "Close navigation" : "Navigate to another section"}
        aria-expanded={open}
        aria-haspopup="true"
        className="w-10 h-10 rounded-full bg-brand-navy text-white flex items-center justify-center hover:bg-brand-deep active:scale-[0.92] transition-[transform,background-color] duration-150 flex-shrink-0"
      >
        <span className={`transition-transform duration-200 ${open ? "rotate-90" : "rotate-0"}`}>
          {open ? <X size={17} /> : <LayoutGrid size={17} />}
        </span>
      </button>
    </div>
  );
}
