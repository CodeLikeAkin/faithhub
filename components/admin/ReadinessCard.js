"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
const noneNeeded = (n) => (n > 0 ? `${fmt(n)} checked as needing none.` : "Not every message has Greek or Hebrew to explain.");
const join = (...parts) => parts.filter(Boolean).join(" ");

// "N missing" opens exactly those messages on the Messages page.
const missingHref = (filter, piece) => `/admin/messages?filter=${filter}&missing=${piece}`;

function catalogView({ coverage: c, segmentGaps, extractions: x }) {
  const n = c.catalog_sermons;
  const rows = x?.rows.catalog;
  const href = (piece) => missingHref("catalog", piece);
  return {
    total: n,
    ringLabel: "of catalog pieces in place",
    description: `The ${fmt(n)} published messages visitors can browse, and which study pieces each one has.`,
    pieces: [
      { label: "Transcript", have: x ? n - x.catalogNoTranscript : null, href: href("transcript") },
      { label: "Searchable in Ask the Word", have: typeof segmentGaps === "number" ? n - segmentGaps : null, href: href("search") },
      { label: "Scripture list", have: n - c.catalog_no_scriptures, note: inAll(rows?.scriptures, "verse references"), href: href("scriptures") },
      { label: "Declarations", have: n - c.catalog_no_declarations, note: inAll(rows?.declarations, "declarations"), href: href("declarations") },
      { label: "Study notes", have: n - c.catalog_no_notes, href: href("notes") },
      {
        label: "Word studies",
        have: n - c.catalog_no_word_studies,
        note: join(inAll(rows?.words, "word studies"), noneNeeded(c.catalog_word_studies_none || 0)),
        href: href("words"),
      },
    ],
  };
}

function libraryView({ coverage: c, extractions: x, declarationsTotal }) {
  const n = c.sermons_total;
  const have = x.library;
  const href = (piece) => missingHref("all", piece);
  return {
    total: n,
    ringLabel: "of library pieces in place",
    description: `All ${fmt(n)} messages, including the ${fmt(n - c.catalog_sermons)} outside the public catalog.`,
    pieces: [
      { label: "Transcript", have: have.transcript, note: "Nothing else can be made without one.", href: href("transcript") },
      { label: "Searchable in Ask the Word", have: have.search, href: href("search") },
      { label: "Scripture list", have: have.scriptures, note: inAll(x.rows.library.scriptures, "verse references"), href: href("scriptures") },
      { label: "Declarations", have: have.declarations, note: inAll(declarationsTotal, "declarations"), href: href("declarations") },
      {
        label: "Study notes",
        have: have.seriesWithNotes,
        total: have.seriesMessages,
        note: `Only written for messages in a series, so this counts the ${fmt(have.seriesMessages)} that are.`,
        href: href("notes"),
      },
      {
        label: "Word studies",
        have: have.words + have.wordsNone,
        note: join(inAll(x.rows.library.words, "word studies"), noneNeeded(have.wordsNone)),
        href: href("words"),
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

function Meter({ label, have, total, note, href, order }) {
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
          {missing > 0 &&
            (href ? (
              <Link
                href={href}
                className="group mr-1 inline-flex items-center gap-1 font-semibold text-white underline decoration-white/30 underline-offset-2 transition-colors hover:decoration-white focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {fmt(missing)} missing
                <ArrowRight size={12} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <span className="font-semibold text-white">{fmt(missing)} missing. </span>
            ))}
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

  // A piece may count against its own total (study notes: series messages only).
  const pieces = view.pieces.map((p) => ({ ...p, total: p.total ?? view.total }));
  const known = pieces.filter((p) => typeof p.have === "number" && p.total > 0);
  const wanted = known.reduce((s, p) => s + p.total, 0);
  const share = wanted ? known.reduce((s, p) => s + p.have, 0) / wanted : 0;

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
            {pieces.map((p, i) => (
              <Meter key={p.label} {...p} order={i} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
