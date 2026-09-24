"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Search, Sparkles } from "lucide-react";
import YtThumb from "@/components/YtThumb";
import { Rings } from "@/components/Decor";
import { Btn, Chip, ConfirmBtn, Field, Input, Notice } from "@/components/admin/controls";
import { adminFetch } from "@/lib/admin-client";
import { fmtDate } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

/** Share of the 4 main pieces in place across a series' parts. */
function readiness(s) {
  if (!s.parts) return 0;
  return (s.with_search + s.with_scriptures + s.with_declarations + s.with_notes) / (4 * s.parts);
}

function SeriesCard({ s }) {
  const share = readiness(s);
  return (
    <li>
      <Link
        href={`/admin/series/${s.id}`}
        className="group flex h-full flex-col overflow-hidden rounded-3xl border border-brand-navy/[0.07] bg-white shadow-[0_1px_2px_rgba(16,42,78,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-20px_rgba(16,42,78,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
      >
        <div className="relative aspect-[16/7] overflow-hidden bg-gradient-to-br from-brand-navy via-brand-deep to-[#0B1F3B]">
          {/* Shown when every thumbnail tried is a dead video. */}
          <div aria-hidden="true" className="absolute inset-0 flex items-end p-4">
            <Rings className="absolute -right-12 -top-16 h-48 w-48 text-white/[0.08]" />
            <span className="relative line-clamp-2 font-display text-lg leading-tight text-white/90">{s.title}</span>
          </div>
          {s.thumbs?.length ? (
            <YtThumb
              ids={s.thumbs}
              quality="mqdefault"
              className="relative h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : null}
        </div>
        <div className="flex flex-1 flex-col p-5">
          <p className="line-clamp-2 font-semibold leading-snug text-brand-ink">{s.title}</p>
          <p className="mt-1 text-sm text-slate-500">
            {s.parts} {s.parts === 1 ? "message" : "messages"}
            {s.start_date ? `, ${fmtDate(s.start_date)}` : ""}
            {s.end_date && s.end_date !== s.start_date ? ` to ${fmtDate(s.end_date)}` : ""}
          </p>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600">Study pieces in place</span>
              <span className="tabular-nums text-slate-500">{Math.round(share * 100)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand-sky">
              <div className="h-full rounded-full bg-brand-navy" style={{ width: `${share * 100}%` }} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {!s.has_summary && <Chip tone="outline">Summary not written yet</Chip>}
            {s.dead_videos > 0 && <Chip tone="bad">{s.dead_videos} video{s.dead_videos === 1 ? "" : "s"} won&apos;t play</Chip>}
            {s.parts < 2 && <Chip tone="warn">Fewer than 2 messages</Chip>}
          </div>
          <span className="mt-auto flex items-center gap-1 pt-4 text-sm font-semibold text-brand-navy">
            Open <ChevronRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    </li>
  );
}

function Proposal({ p, onCreated }) {
  const [title, setTitle] = useState(p.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = `prop-${p.key.replace(/[^a-z0-9]+/g, "-")}`;

  async function create() {
    setBusy(true);
    setError("");
    try {
      const r = await adminFetch("/api/admin/series", {
        method: "POST",
        body: { title, parts: p.parts.map((x) => ({ sermon_id: x.sermon_id, part_number: x.part_number })) },
      });
      onCreated(r.id);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <li className="rounded-3xl border border-brand-navy/[0.07] bg-white p-5 shadow-[0_1px_2px_rgba(16,42,78,0.04)]">
      <Field id={id} label="Series name" hint="Future uploads join this series when this name appears in their YouTube title.">
        <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      {p.notes.length > 0 && (
        <ul className="mt-3 space-y-1">
          {p.notes.map((n) => (
            <li key={n} className="text-sm text-[#7a4f00]">Note: {n}.</li>
          ))}
        </ul>
      )}
      {p.collisions.length > 0 && (
        <Notice tone="info" className="mt-3">
          Two messages share part {p.collisions.join(", ")} (often a morning and evening session). You can fix the numbers after
          creating it.
        </Notice>
      )}
      <ol className="mt-4 divide-y divide-slate-100 rounded-2xl bg-slate-50">
        {p.parts.map((x) => (
          <li key={x.sermon_id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-14 flex-shrink-0 text-sm font-bold tabular-nums text-brand-navy">Part {x.part_number}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-brand-ink" title={x.title}>{x.title}</span>
            <span className="hidden flex-shrink-0 text-xs text-slate-500 sm:inline">
              {fmtDate(x.preached || x.sermon_date)}
            </span>
          </li>
        ))}
      </ol>
      <Notice tone="error" className="mt-3">{error}</Notice>
      <div className="mt-4">
        <ConfirmBtn
          variant="primary"
          size="md"
          question="Create it on the live site?"
          confirmLabel="Create series"
          busy={busy}
          disabled={title.trim().length < 4}
          onConfirm={create}
        >
          Create this series
        </ConfirmBtn>
      </div>
    </li>
  );
}

export default function SeriesBoard({ series, proposals }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [showPossible, setShowPossible] = useState(false);
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return words.length ? series.filter((s) => words.every((w) => s.title.toLowerCase().includes(w))) : series;
  }, [q, series]);

  const suggestions = proposals ? (showPossible ? [...proposals.confident, ...proposals.possible] : proposals.confident) : [];

  return (
    <div className="space-y-10">
      <section aria-labelledby="all-series" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="all-series" className="text-lg font-bold text-brand-ink">
            All series <span className="font-normal text-slate-500">({series.length})</span>
          </h2>
          <div className="relative w-full sm:w-80">
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input aria-label="Filter series by name" placeholder="Filter by name" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
          </div>
        </div>
        {shown.length ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {shown.map((s) => (
              <SeriesCard key={s.id} s={s} />
            ))}
          </ul>
        ) : (
          <p className="rounded-3xl bg-white p-8 text-center text-slate-500 ring-1 ring-brand-navy/[0.07]">No series match that name.</p>
        )}
      </section>

      {proposals && (
        <section aria-labelledby="suggested" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="suggested" className="flex items-center gap-2 text-lg font-bold text-brand-ink">
                <Sparkles size={18} aria-hidden="true" className="text-brand-navy" />
                Suggested new series
              </h2>
              <p className="mt-1 max-w-[65ch] text-sm text-slate-500">
                Messages in no series whose titles clearly belong together. Creating one only adds; nothing is deleted.
              </p>
            </div>
            {proposals.possible.length > 0 && (
              <Btn variant="ghost" size="sm" onClick={() => setShowPossible((s) => !s)}>
                {showPossible ? "Only the strong suggestions" : `Also show ${proposals.possible.length} weaker suggestions`}
              </Btn>
            )}
          </div>
          {suggestions.length ? (
            <ul className={cn("grid grid-cols-1 gap-4 xl:grid-cols-2")}>
              {suggestions.map((p) => (
                <Proposal key={p.key} p={p} onCreated={(id) => router.push(`/admin/series/${id}`)} />
              ))}
            </ul>
          ) : (
            <p className="rounded-3xl bg-white p-8 text-center text-slate-500 ring-1 ring-brand-navy/[0.07]">
              No strong suggestions right now.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
