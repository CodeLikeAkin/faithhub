import { Check, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Shared admin building blocks. Colour rules (dataviz status palette):
 * good #0ca30c, warning #fab219, critical #d03b3b, plus a slate "not known
 * yet". A status colour never carries meaning alone: every badge sits beside
 * a text label, and the glyph inside it differs per state.
 */

export const nf = new Intl.NumberFormat("en-GB");
export const fmt = (n) => (typeof n === "number" ? nf.format(n) : "-");

/** Staggered entrance; skipped entirely for people who ask for less motion. */
export const rise = (order = 0) => ({
  className: "motion-safe:animate-rise",
  style: { animationDelay: `${order * 70}ms` },
});

export function Card({ title, subtitle, action, order = 0, className, children, id, tone = "light" }) {
  const r = rise(order);
  return (
    <section
      id={id}
      aria-labelledby={title && id ? `${id}-title` : undefined}
      style={r.style}
      className={cn(
        r.className,
        "relative rounded-3xl",
        tone === "light" &&
          "border border-brand-navy/[0.07] bg-white shadow-[0_1px_2px_rgba(16,42,78,0.04),0_12px_32px_-18px_rgba(16,42,78,0.18)]",
        className
      )}
    >
      {title && (
        <header className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <h2 id={id ? `${id}-title` : undefined} className="text-lg font-bold text-brand-ink">
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

const TONES = {
  good: { bg: "bg-[#0ca30c]", glyph: <Check size={12} strokeWidth={3} className="text-white" /> },
  critical: { bg: "bg-[#d03b3b]", glyph: <X size={12} strokeWidth={3} className="text-white" /> },
  warning: { bg: "bg-[#fab219]", glyph: <span className="text-xs font-black leading-none text-brand-ink">!</span> },
  neutral: { bg: "bg-slate-500", glyph: <Minus size={12} strokeWidth={3} className="text-white" /> },
};

const TONE_WORD = { good: "OK", critical: "Problem", warning: "Needs attention", neutral: "Not known yet" };

/** A small round status mark. Always pair it with visible text. */
export function StatusBadge({ tone = "neutral", className }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span
      className={cn("inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full", t.bg, className)}
      role="img"
      aria-label={TONE_WORD[tone]}
    >
      <span aria-hidden="true" className="flex">{t.glyph}</span>
    </span>
  );
}

/** Stat tile: label, value, one line of context. Proportional figures on purpose. */
export function StatTile({ icon: Icon, label, value, note, order = 0 }) {
  const r = rise(order);
  return (
    <div
      style={r.style}
      className={cn(
        r.className,
        "group relative overflow-hidden rounded-3xl border border-brand-navy/[0.07] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,78,0.04),0_12px_32px_-18px_rgba(16,42,78,0.18)] transition-transform duration-300 hover:-translate-y-0.5 sm:p-5"
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-sky text-brand-navy transition-colors duration-300 group-hover:bg-brand-navy group-hover:text-white">
          <Icon size={20} aria-hidden="true" />
        </span>
        <p className="text-sm font-medium leading-snug text-slate-600">{label}</p>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-brand-ink sm:mt-5 sm:text-4xl">{value}</p>
      {note && <p className="mt-1.5 text-sm leading-snug text-slate-500">{note}</p>}
    </div>
  );
}
