"use client";

import { Volume2 } from "lucide-react";

/**
 * The sticky "Speak all" button at the foot of a declaration list. Placed
 * after the list inside the scroll container: it rides the bottom of the view
 * while the list scrolls and settles at the end of it.
 */
export default function SpeakAllBar({ label, onSpeak, disabled = false }) {
  return (
    <div className="pointer-events-none sticky bottom-0 z-10 flex justify-center pb-[calc(1rem+env(safe-area-inset-bottom))] pt-8">
      <button
        type="button"
        onClick={onSpeak}
        disabled={disabled}
        className="pointer-events-auto inline-flex h-12 items-center gap-2 rounded-full bg-brand-navy px-6 text-sm font-bold text-white shadow-xl shadow-brand-navy/30 transition-colors hover:bg-brand-deep disabled:opacity-50"
      >
        <Volume2 size={17} aria-hidden="true" />
        {label}
      </button>
    </div>
  );
}
