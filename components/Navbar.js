"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, Search } from "lucide-react";
import Button from "@/components/Button";

const TOOL_ROUTES = ["/ask", "/declarations", "/series", "/sermon", "/word", "/admin"];

const navLinks = [
  { name: "Home", href: "/" },
  { name: "Ask", href: "/ask" },
  { name: "Series Study", href: "/series" },
  { name: "The Word", href: "/word" },
  { name: "Vision", href: "/vision" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const submitSearch = (e) => {
    e.preventDefault();
    const text = query.trim();
    if (!text) return;
    router.push(`/ask?q=${encodeURIComponent(text)}`);
    setQuery("");
    setSearchOpen(false);
  };

  // Ground the pill once you scroll off the top (works on any page —
  // /series and /word open on white, home opens on the dark hero).
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Every tool page (and admin) brings its own chrome — components/shell/
  // ToolShell. Prefix match: the tools have sub-pages (/declarations/faith,
  // /word/romans/8, /series/[id], /sermon/[id]). Only Home and Vision keep
  // this bar.
  const hidden = TOOL_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  if (hidden) return null;

  return (
    <header
      className={`fixed inset-x-0 z-50 px-4 sm:px-6 transition-all duration-300 ${
        scrolled ? "top-2 sm:top-3" : "top-3 sm:top-5"
      }`}
    >
      <nav className="mx-auto max-w-6xl flex">
        {/* One unified pill: logo · links · CTA — centered on desktop,
            a full-width bar (logo + menu) on mobile. */}
        <div
          className={`w-full md:w-auto md:mx-auto flex items-center justify-between gap-3 sm:gap-4 rounded-full backdrop-blur-md border py-1.5 pl-3.5 pr-1.5 transition-all duration-300 ${
            scrolled
              ? "bg-white/95 border-brand-navy/10 shadow-lg shadow-brand-navy/10"
              : "bg-white/80 border-brand-navy/5 shadow-md shadow-brand-navy/5"
          }`}
        >
          <Link href="/" onClick={() => setIsOpen(false)} className="flex items-center">
            <Image
              src="/hofng-logo.png"
              alt="Heritage of Faith"
              width={208}
              height={146}
              className="h-7 w-auto"
              priority
            />
          </Link>

          <span className="hidden md:block w-px h-4 bg-brand-navy/15" />

          <div className="hidden md:flex items-center gap-4">
            {/* No "Home" here — the logo beside it already goes home. The mobile menu keeps it. */}
            {navLinks.filter((link) => link.href !== "/").map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "text-brand-navy"
                    : "text-brand-gray hover:text-brand-navy"
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          <span className="hidden md:block w-px h-4 bg-brand-navy/15" />

          <Button
            href="/declarations"
            variant="dark"
            size="sm"
            className="hidden md:inline-flex"
          >
            Declare the Word
          </Button>

          {/* Quick ask — expands into an inline search below the pill.
              Desktop only: on mobile the pill has no room for a third icon
              next to the hamburger, so search moves into the mobile panel
              below instead. */}
          <button
            onClick={() => {
              setSearchOpen((o) => !o);
              setIsOpen(false);
            }}
            aria-label={searchOpen ? "Close search" : "Search"}
            aria-expanded={searchOpen}
            className="hidden md:flex w-9 h-9 items-center justify-center rounded-full text-brand-navy hover:bg-brand-sky transition-colors"
          >
            {searchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </button>

          {/* Mobile menu button — lives inside the pill on small screens */}
          <button
            onClick={() => {
              setIsOpen(!isOpen);
              setSearchOpen(false);
            }}
            aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isOpen}
            className="md:hidden w-9 h-9 -mr-1 flex items-center justify-center rounded-full text-brand-navy hover:bg-brand-sky transition-colors"
          >
            {isOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </nav>

      {/* Tap-away scrim — covers the page behind the open menu or search */}
      {(isOpen || searchOpen) && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => {
            setIsOpen(false);
            setSearchOpen(false);
          }}
          aria-hidden="true"
        />
      )}

      {/* Search panel */}
      {searchOpen && (
        <div className="relative z-[41] mx-auto max-w-md mt-2 px-4 sm:px-0">
          <form
            role="search"
            onSubmit={submitSearch}
            className="flex items-center gap-2 rounded-full bg-white p-1.5 pl-5 shadow-xl shadow-brand-navy/10 ring-1 ring-brand-navy/10 focus-within:ring-2 focus-within:ring-brand-navy/20"
          >
            <Search size={18} aria-hidden="true" className="flex-shrink-0 text-brand-gray" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything Rev. Peter has taught…"
              aria-label="Ask anything Rev. Peter has taught"
              enterKeyHint="search"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-brand-ink placeholder:text-brand-gray/80 focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Ask"
              className="inline-flex h-11 flex-shrink-0 items-center gap-2 rounded-full bg-brand-navy px-4 text-sm font-bold text-white transition-colors hover:bg-brand-deep sm:px-5"
            >
              <span className="hidden sm:inline">Ask</span>
              <Search size={16} aria-hidden="true" className="sm:hidden" />
            </button>
          </form>
        </div>
      )}

      {/* Mobile panel */}
      {isOpen && (
        <div className="md:hidden relative z-[41] mx-auto max-w-6xl mt-2 bg-white rounded-3xl border border-brand-navy/10 shadow-xl p-3">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setSearchOpen(true);
            }}
            className="flex w-full items-center gap-3 px-4 py-3.5 rounded-2xl text-base font-medium text-brand-ink hover:bg-brand-sky"
          >
            <Search size={18} aria-hidden="true" className="flex-shrink-0 text-brand-navy" />
            Search
          </button>
          <div className="my-1 border-t border-brand-navy/10" />
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="block px-4 py-3.5 rounded-2xl text-base font-medium text-brand-ink hover:bg-brand-sky"
            >
              {link.name}
            </Link>
          ))}
          <div className="mt-1 pt-3 border-t border-brand-navy/10">
            <Button
              href="/declarations"
              variant="dark"
              size="lg"
              onClick={() => setIsOpen(false)}
              className="w-full justify-center"
            >
              Declare the Word
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
