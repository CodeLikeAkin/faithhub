import { Rings } from "@/components/Decor";
import { fmt, rise } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

/*
 * The dashboard's lead: how complete the public catalog is. One hero figure
 * (share of all catalog pieces in place) drawn as a ring meter, then one meter
 * per piece. Meters are single-hue: a sky fill on a lighter step of the same
 * navy (white at 12%), so state reads along the whole bar.
 */

function Ring({ share }) {
  const pct = Math.round(share * 100);
  return (
    <div className="relative h-44 w-44 flex-shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9" />
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke="#C6DAEE"
          strokeWidth="9"
          strokeLinecap="round"
          pathLength="1"
          strokeDasharray={`${share} 1`}
          className="motion-safe:animate-ring-fill"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-5xl font-bold tracking-tight text-white">
          {pct}
          <span className="text-2xl font-semibold text-brand-mist">%</span>
        </span>
        <span className="mt-1 max-w-[7.5rem] text-xs leading-snug text-brand-mist">of catalog pieces in place</span>
      </div>
    </div>
  );
}

function Meter({ label, have, total, note, order }) {
  const unknown = typeof have !== "number";
  const share = unknown || !total ? 0 : have / total;
  const missing = unknown ? null : total - have;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium text-white">{label}</span>
        <span className="text-sm tabular-nums text-brand-mist">
          {unknown ? "Couldn't check" : `${fmt(have)} of ${fmt(total)}`}
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.12]"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total || 0}
        aria-valuenow={unknown ? undefined : have}
        aria-valuetext={unknown ? "Could not check" : `${have} of ${total}`}
      >
        <div
          className="h-full origin-left rounded-full bg-[#C6DAEE] motion-safe:animate-grow-x"
          style={{ width: `${share * 100}%`, animationDelay: `${200 + order * 90}ms` }}
        />
      </div>
      {(note || (missing > 0)) && (
        <p className="mt-1.5 text-xs text-brand-mist/90">
          {missing > 0 && <span className="font-semibold text-white">{fmt(missing)} missing. </span>}
          {note}
        </p>
      )}
    </li>
  );
}

export default function ReadinessCard({ coverage, segmentGaps, order = 0, className }) {
  const n = coverage.catalog_sermons;
  const pieces = [
    { label: "Searchable in Ask the Word", have: typeof segmentGaps === "number" ? n - segmentGaps : null },
    { label: "Scripture list", have: n - coverage.catalog_no_scriptures },
    { label: "Declarations", have: n - coverage.catalog_no_declarations },
    { label: "Study notes", have: n - coverage.catalog_no_notes },
    {
      label: "Word studies",
      have: n - coverage.catalog_no_word_studies,
      note: "Not every message has Greek or Hebrew to explain.",
    },
  ];
  const known = pieces.filter((p) => typeof p.have === "number");
  const share = known.length && n ? known.reduce((s, p) => s + p.have, 0) / (known.length * n) : 0;

  const r = rise(order);
  return (
    <section
      aria-labelledby="readiness-title"
      style={r.style}
      className={cn(
        r.className,
        "relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-navy via-brand-deep to-[#0B1F3B] p-6 text-white shadow-[0_24px_48px_-24px_rgba(16,42,78,0.55)] sm:p-8",
        className
      )}
    >
      <Rings className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 text-white/[0.06]" />
      <div className="relative">
        <h2 id="readiness-title" className="text-lg font-bold">Catalog readiness</h2>
        <p className="mt-1 text-sm text-brand-mist">
          The {fmt(n)} messages visitors can browse, and which study pieces each one has.
        </p>

        <div className="mt-8 flex flex-col items-center gap-8 md:flex-row md:items-center md:gap-10">
          <Ring share={share} />
          <ul className="w-full flex-1 space-y-5">
            {pieces.map((p, i) => (
              <Meter key={p.label} {...p} total={n} order={i} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
