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
