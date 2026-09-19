"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import Button from "@/components/Button";

const navLinks = [
  { name: "Home", href: "/" },
  { name: "Ask", href: "/ask" },
  { name: "Series Study", href: "/series" },
  { name: "The Word", href: "/word" },
  { name: "Vision", href: "/vision" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  // Ground the pill once you scroll off the top (works on any page —
  // /series and /word open on white, home opens on the dark hero).
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Immersive app views (chat, study, admin) bring their own chrome
  const hidden =
    pathname === "/declarations" ||
    pathname === "/admin" ||
    pathname === "/ask" ||
    /^\/series\/.+/.test(pathname) ||
    /^\/sermon\/.+/.test(pathname);
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
          className={`w-full md:w-auto md:mx-auto flex items-center justify-between gap-3 sm:gap-5 rounded-full backdrop-blur-md border py-2 pl-4 pr-2 transition-all duration-300 ${
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
              className="h-8 w-auto"
              priority
            />
          </Link>

          <span className="hidden md:block w-px h-5 bg-brand-navy/15" />

          <div className="hidden md:flex items-center gap-5">
            {navLinks.map((link) => (
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

          <span className="hidden md:block w-px h-5 bg-brand-navy/15" />

          <Button
            href="/declarations"
            variant="dark"
            size="sm"
            className="hidden md:inline-flex"
          >
            Declare the Word
          </Button>

          {/* Mobile menu button — lives inside the pill on small screens */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isOpen}
            className="md:hidden w-11 h-11 -mr-1 flex items-center justify-center rounded-full text-brand-navy hover:bg-brand-sky transition-colors"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Tap-away scrim — covers the page behind the open menu */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile panel */}
      {isOpen && (
        <div className="md:hidden relative z-[41] mx-auto max-w-6xl mt-2 bg-white rounded-3xl border border-brand-navy/10 shadow-xl p-3">
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
