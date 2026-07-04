"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowRight } from "lucide-react";

const navLinks = [
  { name: "Home", href: "/" },
  { name: "Ask", href: "/ask" },
  { name: "Declarations", href: "/declarations" },
  { name: "Series Study", href: "/series" },
  { name: "The Word", href: "/word" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Immersive app views (chat, study, admin) bring their own chrome
  const hidden =
    pathname === "/declarations" ||
    pathname === "/admin" ||
    pathname === "/ask" ||
    /^\/series\/.+/.test(pathname);
  if (hidden) return null;

  return (
    <header className="fixed top-3 sm:top-5 inset-x-0 z-50 px-4 sm:px-6">
      <nav className="mx-auto max-w-6xl flex items-center justify-between gap-3">
        {/* Floating pill: logo + links */}
        <div className="flex items-center gap-3 sm:gap-6 bg-white/95 backdrop-blur-md border border-brand-navy/10 shadow-lg shadow-brand-navy/5 rounded-full pl-4 pr-4 sm:pr-6 py-2">
          <Link href="/" onClick={() => setIsOpen(false)} className="flex items-center">
            <Image
              src="/hofng-logo.png"
              alt="Heritage of Faith"
              width={120}
              height={40}
              className="h-8 w-auto object-contain"
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
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/declarations"
            className="hidden sm:inline-flex items-center gap-2 bg-brand-navy text-white text-sm font-bold rounded-full px-5 py-3 shadow-lg shadow-brand-navy/20 hover:bg-brand-deep transition-colors"
          >
            Start a declaration
            <ArrowRight className="w-4 h-4" />
          </Link>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
            className="md:hidden w-11 h-11 flex items-center justify-center bg-white/95 backdrop-blur-md border border-brand-navy/10 shadow-lg shadow-brand-navy/5 rounded-full text-brand-navy"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile panel */}
      {isOpen && (
        <div className="md:hidden mx-auto max-w-6xl mt-2 bg-white rounded-3xl border border-brand-navy/10 shadow-xl p-3">
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
          <Link
            href="/declarations"
            onClick={() => setIsOpen(false)}
            className="mt-1 flex items-center justify-center gap-2 bg-brand-navy text-white font-bold rounded-2xl px-4 py-3.5"
          >
            Start a declaration
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </header>
  );
}
