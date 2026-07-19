"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * ThemeToggle — flips the `dark` class on <html> and persists the choice.
 * The initial class is set pre-paint by the inline script in app/layout.js
 * (no flash); this component just keeps React state in sync and lets the
 * user switch. Drop it into any header/nav. `className` styles the button so
 * it can match either the light nav pill or a dark immersive header.
 */
export default function ThemeToggle({ className = "" }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    // Derive the next state from the live DOM class, not React state, so the
    // toggle stays correct even when more than one instance is mounted (the
    // Navbar renders a desktop and a mobile copy) and their local state drifts.
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch (e) {
      /* storage unavailable — theme still applies for this session */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={
        className ||
        "w-9 h-9 flex items-center justify-center rounded-full text-brand-gray hover:text-brand-navy hover:bg-brand-sky transition-colors"
      }
    >
      {/* Render nothing theme-specific until mounted to avoid a hydration mismatch */}
      {mounted && dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
    </button>
  );
}
