"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";

const navLinks = [
  { name: "Home", href: "/" },
  { name: "Declarations", href: "/declarations" },
  { name: "Series Study", href: "/series" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav 
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled 
          ? "bg-white/95 backdrop-blur-md py-3 shadow-md border-b border-gray-100" 
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <div className="relative w-[150px] h-[50px]">
                <Image
                  src="/hofng-logo.png"
                  alt="HOFNG Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-brand-green ${
                  scrolled ? "text-brand-navy" : "text-white"
                }`}
              >
                {link.name}
              </Link>
            ))}
            <Link
              href="/declarations"
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-105 ${
                scrolled 
                  ? "bg-brand-navy text-white hover:bg-brand-green" 
                  : "bg-white text-brand-navy hover:bg-brand-green hover:text-white"
              }`}
            >
              Get Started
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`p-2 rounded-md transition-colors ${
                scrolled ? "text-brand-navy" : "text-white"
              }`}
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div
        className={`md:hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-height-screen opacity-100" : "max-h-0 opacity-0 overflow-hidden"
        } bg-white border-b border-gray-100 shadow-xl`}
      >
        <div className="px-4 pt-2 pb-6 space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="block px-3 py-4 text-base font-medium text-brand-navy hover:bg-gray-50 hover:text-brand-green rounded-lg"
            >
              {link.name}
            </Link>
          ))}
          <Link
            href="/declarations"
            onClick={() => setIsOpen(false)}
            className="block w-full text-center px-4 py-4 bg-brand-navy text-white font-bold rounded-xl hover:bg-brand-green transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
