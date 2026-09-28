"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, Search, Home as HomeIcon, Compass } from "lucide-react";
import Button from "@/components/Button";
import ToolRail from "@/components/shell/ToolRail";
import { deleteStudyWithUndo, useToast } from "@/components/shell/Toast";

const TOOL_ROUTES = ["/ask", "/declarations", "/series", "/sermon", "/word", "/admin"];

// Desktop pill only — unchanged.
const desktopNavLinks = [
  { name: "Home", href: "/" },
  { name: "Ask", href: "/ask" },
  { name: "Series Study", href: "/series" },
  { name: "The Word", href: "/word" },
  { name: "Vision", href: "/vision" },
];

// Mobile menu only: Home and Vision bracket the same tool list ToolShell's
// rail already shows, so Ask/Series/Declarations/Word aren't a second,
// differently-designed nav on marketing pages.
const HOME_LINK = { name: "Home", href: "/", icon: HomeIcon, match: (p) => p === "/" };
const VISION_LINK = { name: "Vision", href: "/vision", icon: Compass, match: (p) => p.startsWith("/vision") };

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchInputRef = useRef(null);
  const menuButtonRef = useRef(null);
  const drawerCloseRef = useRef(null);
  const [railToast, showRailToast] = useToast();
  const onDeleteStudy = (id) => deleteStudyWithUndo(id, showRailToast);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // The mobile drawer is full-height, like ToolShell's — lock scroll and
  // close on Escape while it's open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (isOpen) drawerCloseRef.current?.focus();
    else if (wasOpen.current) menuButtonRef.current?.focus();
    wasOpen.current = isOpen;
  }, [isOpen]);

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
            {desktopNavLinks.filter((link) => link.href !== "/").map((link) => (
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

          {/* Quick ask — expands into an inline search below the pill. */}
          <button
            onClick={() => {
              setSearchOpen((o) => !o);
              setIsOpen(false);
            }}
            aria-label={searchOpen ? "Close search" : "Search"}
            aria-expanded={searchOpen}
            className="flex w-9 h-9 items-center justify-center rounded-full text-brand-navy hover:bg-brand-sky transition active:scale-95"
          >
            {searchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </button>

          {/* Mobile menu button — lives inside the pill on small screens */}
          <button
            ref={menuButtonRef}
            onClick={() => {
              setIsOpen(!isOpen);
              setSearchOpen(false);
            }}
            aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isOpen}
            className="md:hidden w-9 h-9 -mr-1 flex items-center justify-center rounded-full text-brand-navy hover:bg-brand-sky transition active:scale-95"
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
              className="inline-flex h-11 flex-shrink-0 items-center gap-2 rounded-full bg-brand-navy px-4 text-sm font-bold text-white transition hover:bg-brand-deep active:scale-[0.97] sm:px-5"
            >
              <span className="hidden sm:inline">Ask</span>
              <Search size={16} aria-hidden="true" className="sm:hidden" />
            </button>
          </form>
        </div>
      )}

      {/* Mobile drawer — the same rail Ask/Series/Declarations/Word use,
          with Home and Vision bracketing the tool list, so there's one
          mobile nav pattern across the whole app instead of two. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        {...(!isOpen ? { inert: "", "aria-hidden": true } : {})}
        className={`fixed inset-y-0 left-0 z-50 w-[min(20rem,86vw)] bg-brand-sky shadow-2xl transition-transform duration-300 md:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <button
          ref={drawerCloseRef}
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close menu"
          className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full text-brand-gray transition hover:bg-white hover:text-brand-navy active:scale-95"
          style={{ marginTop: "env(safe-area-inset-top)" }}
        >
          <X size={20} aria-hidden="true" />
        </button>
        <ToolRail
          mode="expanded"
          onNavigate={() => setIsOpen(false)}
          onDeleteStudy={onDeleteStudy}
          leadingLinks={[HOME_LINK]}
          trailingLinks={[VISION_LINK]}
          footerCta={
            <Button
              href="/declarations"
              variant="dark"
              size="lg"
              onClick={() => setIsOpen(false)}
              className="mt-3 w-full justify-center"
            >
              Declare the Word
            </Button>
          }
        />
      </div>
      {railToast}
    </header>
  );
}
