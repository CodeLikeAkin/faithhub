import { cn } from "@/lib/utils";

/*
 * The Vision page's decorative devices (see app/vision/VisionContent.js),
 * shared so the tool pages speak the same visual language. Purely
 * decorative: aria-hidden, pointer-events off.
 */

export function Rings({ className }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 400 400" fill="none" className={className}>
      {[195, 170, 145, 120, 95, 70, 45].map((r) => (
        <circle key={r} cx="200" cy="200" r={r} stroke="currentColor" strokeWidth="1" />
      ))}
    </svg>
  );
}

export function DotGrid({ dark = false, className }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute bg-[length:22px_22px]",
        dark
          ? "bg-[radial-gradient(circle,rgba(255,255,255,0.14)_1px,transparent_1.5px)]"
          : "bg-[radial-gradient(circle,rgba(23,58,104,0.16)_1px,transparent_1.5px)]",
        className
      )}
    />
  );
}

export function QuoteGlyph({ className }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 48" fill="currentColor" className={className}>
      <path d="M0 48V28C0 12.5 8 3.2 24 0l3 6.4C17.4 9.4 13 15 13 22h11v26H0Zm37 0V28C37 12.5 45 3.2 61 0l3 6.4C54.4 9.4 50 15 50 22h11v26H37Z" />
    </svg>
  );
}

/* The small caps label with a leading rule that opens each Vision section. */
export function Eyebrow({ tone = "light", className, children }) {
  const dark = tone === "dark";
  return (
    <p
      className={cn(
        "inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em]",
        dark ? "text-white/65" : "text-brand-navy",
        className
      )}
    >
      <span aria-hidden="true" className={cn("h-px w-8 flex-shrink-0", dark ? "bg-white/40" : "bg-brand-navy/40")} />
      {children}
    </p>
  );
}
