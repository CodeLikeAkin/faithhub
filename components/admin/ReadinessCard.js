"use client";

import { useState } from "react";
import { Rings } from "@/components/Decor";
import { fmt, rise } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

/*
 * The dashboard's lead: how complete the public catalog is. One hero figure
 * (share of all catalog pieces in place) drawn as a ring meter, then one meter
 * per piece. Meters are single-hue: a sky fill on a lighter step of the same
 * navy (white at 12%), so state reads along the whole bar.
 *
 * A switch flips the same view to the whole library (series and non-series
 * messages alike). It only shows when the library counts loaded.
 */

const SCOPES = [
  { key: "catalog", label: "Catalog" },
  { key: "library", label: "Whole library" },
];

const inAll = (rows, unit) => (typeof rows === "number" ? `${fmt(rows)} ${unit} in all.` : null);

function catalogView({ coverage: c, segmentGaps, extractions: x }) {
  const n = c.catalog_sermons;
  const rows = x?.rows.catalog;
  return {
    total: n,
    ringLabel: "of catalog pieces in place",
    description: `The ${fmt(n)} messages visitors can browse, and which study pieces each one has.`,
    pieces: [
      { label: "Transcript", have: x ? n - x.catalogNoTranscript : null },
      { label: "Searchable in Ask the Word", have: typeof segmentGaps === "number" ? n - segmentGaps : null },
      { label: "Scripture list", have: n - c.catalog_no_scriptures, note: inAll(rows?.scriptures, "verse references") },
      { label: "Declarations", have: n - c.catalog_no_declarations, note: inAll(rows?.declarations, "declarations") },
      { label: "Study notes", have: n - c.catalog_no_notes },
      {
        label: "Word studies",
        have: n - c.catalog_no_word_studies,
        note: [inAll(rows?.words, "word studies"), "Not every message has Greek or Hebrew to explain."].filter(Boolean).join(" "),
      },
    ],
  };
}

function libraryView({ coverage: c, extractions: x, declarationsTotal }) {
  const n = c.sermons_total;
  const have = x.library;
  return {
    total: n,
    ringLabel: "of library pieces in place",
    description: `All ${fmt(n)} messages, including the ${fmt(n - c.catalog_sermons)} outside a series that visitors don't browse.`,
    pieces: [
      { label: "Transcript", have: have.transcript, note: "Nothing else can be made without one." },
      { label: "Searchable in Ask the Word", have: have.search },
      { label: "Scripture list", have: have.scriptures, note: inAll(x.rows.library.scriptures, "verse references") },
      { label: "Declarations", have: have.declarations, note: inAll(declarationsTotal, "declarations") },
      { label: "Study notes", have: have.notes, note: "Only written for messages in a series." },
      {
        label: "Word studies",
        have: have.words,
        note: [inAll(x.rows.library.words, "word studies"), "Not every message has Greek or Hebrew to explain."].filter(Boolean).join(" "),
      },
    ],
  };
}

function Ring({ share, label }) {
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
        <span className="mt-1 max-w-[7.5rem] text-xs leading-snug text-brand-mist">{label}</span>
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

function ScopeSwitch({ scope, onChange }) {
  return (
    <div
      role="group"
      aria-label="Show readiness for"
      className="flex flex-shrink-0 gap-1 self-start whitespace-nowrap rounded-full bg-white/[0.08] p-1 ring-1 ring-white/10"
    >
      {SCOPES.map((s) => (
        <button
          key={s.key}
          type="button"
          aria-pressed={scope === s.key}
          onClick={() => onChange(s.key)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
            scope === s.key ? "bg-white text-brand-navy" : "text-brand-mist hover:bg-white/10 hover:text-white"
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export default function ReadinessCard({ coverage, segmentGaps, extractions, declarationsTotal, order = 0, className }) {
  const [scope, setScope] = useState("catalog");
  const canSwitch = !!extractions;
  const view =
    scope === "library" && canSwitch
      ? libraryView({ coverage, extractions, declarationsTotal })
      : catalogView({ coverage, segmentGaps, extractions });

  const n = view.total;
  const known = view.pieces.filter((p) => typeof p.have === "number");
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="readiness-title" className="text-lg font-bold">
              {scope === "library" && canSwitch ? "Library readiness" : "Catalog readiness"}
            </h2>
            <p className="mt-1 text-sm text-brand-mist" aria-live="polite">
              {view.description}
            </p>
          </div>
          {canSwitch && <ScopeSwitch scope={scope} onChange={setScope} />}
        </div>

        {/* Keyed by scope so the ring and bars replay their fill on each switch. */}
        <div key={scope} className="mt-8 flex flex-col items-center gap-8 md:flex-row md:items-center md:gap-10">
          <Ring share={share} label={view.ringLabel} />
          <ul className="w-full flex-1 space-y-5">
            {view.pieces.map((p, i) => (
              <Meter key={p.label} {...p} total={n} order={i} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
