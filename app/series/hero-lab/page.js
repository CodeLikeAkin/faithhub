"use client";

/**
 * /series/hero-lab — a scratch comparison page, NOT shipped UI.
 *
 * Four candidate designs for the "Latest series" hero on /series, each
 * rendered from real series data, with a picker so any series in the catalog
 * can be dropped into all four at once. The point is consistency: a hero that
 * only looks good on one cover is not a design, it's a coincidence.
 *
 * Delete this route once a direction is chosen.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Shuffle } from "lucide-react";
import ToolShell from "@/components/shell/ToolShell";
import { DotGrid, Rings } from "@/components/Decor";
import YtThumb from "@/components/YtThumb";
import { supabase } from "@/lib/supabase";
import { partTitle, seriesName } from "@/lib/titles";
import { cn } from "@/lib/utils";

const fmtRange = (start, end) => {
  if (!start) return "";
  const o = { month: "short", year: "numeric", timeZone: "UTC" };
  const s = new Date(start).toLocaleDateString("en-US", o);
  const e = end ? new Date(end).toLocaleDateString("en-US", o) : s;
  return s === e ? s : `${s} – ${e}`;
};

/* ---------------------------------------------------------------- shared */

/** Eyebrow used by every option, so they differ in layout and not in voice. */
function Eyebrow({ dark, children }) {
  return (
    <p className={cn("text-xs font-bold uppercase tracking-[0.18em]", dark ? "text-white/55" : "text-brand-navy/60")}>
      {children}
    </p>
  );
}

/** The only art any option is allowed to show: contained, never a background. */
function Cover({ s, className, quality = "hqdefault" }) {
  return (
    <span className={cn("relative block overflow-hidden bg-brand-deep", className)}>
      <DotGrid dark className="inset-0" />
      <YtThumb ids={s.covers} quality={quality} className="relative h-full w-full object-cover" />
    </span>
  );
}

/* --------------------------------------------------------------- OPTION A
   Light card, contained cover. Same white-card vocabulary as the grid below
   it — the hero is just a bigger card, so nothing on the page changes key. */

function OptionA({ s }) {
  return (
    <section className="grid overflow-hidden rounded-[1.75rem] border border-brand-navy/12 bg-white shadow-[0_30px_60px_-45px_rgba(16,42,78,0.5)] sm:rounded-[2rem] min-[1120px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      {/* Full-bleed, with the 16:9 quality ladder: hqdefault is 4:3 with black
          letterbox bars baked in, which only vanish in an exactly-16:9 box.
          `aspect-video` holds the picture at 16:9 at every width, so nothing is
          ever cropped or barred; when the panel beside it runs taller the slack
          shows as a brand-sky mat rather than a gap in the card. */}
      <div className="flex items-center justify-center bg-brand-sky">
        <Cover s={s} quality={["maxresdefault", "hq720", "mqdefault"]} className="aspect-video w-full" />
      </div>
      <div className="flex min-w-0 flex-col justify-center px-5 py-6 sm:px-8 sm:py-6">
        <Eyebrow>Latest series</Eyebrow>
        <h2 className="mt-2 font-display text-2xl font-medium leading-[1.1] tracking-tight text-brand-ink text-balance sm:text-3xl xl:text-4xl">
          {s.title}
        </h2>
        <p className="mt-2.5 text-sm text-brand-gray">
          {s.parts} {s.parts === 1 ? "part" : "parts"}
          {s.range && ` · ${s.range}`}
        </p>

        <ol className="mt-4 border-t border-brand-navy/10">
          {s.partList.slice(0, 4).map((p) => (
            <li key={p.id || p.n} className="border-b border-brand-navy/10">
              <Link href={`/sermon/${p.id}`} className="flex items-center gap-3 py-1.5 hover:text-brand-navy">
                <span className="w-5 flex-shrink-0 text-xs font-bold tabular-nums text-brand-navy/50">{p.n}</span>
                <span className="min-w-0 text-sm leading-snug text-brand-ink lg:truncate">{p.title}</span>
              </Link>
            </li>
          ))}
        </ol>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {s.partList[0]?.id && (
            <Link
              href={`/sermon/${s.partList[0].id}`}
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
            >
              Start with Part 1 <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
          <Link
            href={`/series/${s.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-brand-navy/25 px-6 py-3 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-sky"
          >
            All {s.parts} parts
          </Link>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- OPTION B
   Editorial index. No hero art beyond a thumbnail chip, so cover quality
   can't make or break it. Every part is listed in full, wrapped rather than
   truncated — the series reads as a syllabus. */

function OptionB({ s }) {
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] bg-brand-sky/60 px-5 py-7 sm:rounded-[2rem] sm:px-10 sm:py-10">
      <Rings className="pointer-events-none absolute -right-40 -top-40 h-[30rem] w-[30rem] text-brand-navy/[0.07]" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Eyebrow>Latest series</Eyebrow>
          <h2 className="mt-2.5 max-w-3xl font-display text-3xl font-medium leading-[1.05] tracking-tight text-brand-ink text-balance sm:text-5xl">
            {s.title}
          </h2>
          <p className="mt-3 text-sm text-brand-gray">
            {s.parts} {s.parts === 1 ? "part" : "parts"}
            {s.range && ` · ${s.range}`}
          </p>
        </div>
        <Cover s={s} quality="mqdefault" className="aspect-video w-40 flex-shrink-0 rounded-xl ring-1 ring-brand-navy/10 sm:w-56" />
      </div>

      <ol className="relative mt-7 gap-x-10 border-t border-brand-navy/15 pt-2 sm:columns-2">
        {s.partList.map((p) => (
          <li key={p.id || p.n} className="break-inside-avoid border-b border-brand-navy/10">
            <Link href={`/sermon/${p.id}`} className="group flex items-baseline gap-3 py-2.5">
              <span className="w-6 flex-shrink-0 text-xs font-bold tabular-nums text-brand-navy/50">
                {String(p.n).padStart(2, "0")}
              </span>
              <span className="min-w-0 text-sm leading-snug text-brand-ink group-hover:text-brand-navy group-hover:underline">
                {p.title}
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <div className="relative mt-7 flex flex-wrap items-center gap-3">
        {s.partList[0]?.id && (
          <Link
            href={`/sermon/${s.partList[0].id}`}
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
          >
            Start with Part 1 <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
        <Link href={`/series/${s.id}`} className="text-sm font-bold text-brand-navy hover:underline">
          Open the series
        </Link>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- OPTION C
   The dark band, kept — but the background is brand-owned (navy gradient +
   the Vision decor) instead of a blurred crop of the cover, so it renders
   identically whatever the artwork is. Parts become a scroll rail. */

function OptionC({ s }) {
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-brand-navy via-brand-deep to-brand-ink text-white sm:rounded-[2rem]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <DotGrid dark className="inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_60%)]" />
        <Rings className="absolute -bottom-48 -right-48 h-[34rem] w-[34rem] text-white/[0.07]" />
      </div>

      <div className="relative flex flex-col gap-7 px-5 py-7 sm:px-10 sm:py-10 lg:flex-row lg:items-center">
        <Cover s={s} className="aspect-video w-full flex-shrink-0 rounded-2xl ring-1 ring-white/15 lg:w-[22rem]" />
        <div className="min-w-0">
          <Eyebrow dark>Latest series</Eyebrow>
          <h2 className="mt-2.5 font-display text-3xl font-medium leading-[1.05] tracking-tight text-balance sm:text-5xl">
            {s.title}
          </h2>
          <p className="mt-3 text-sm text-white/65">
            {s.parts} {s.parts === 1 ? "part" : "parts"}
            {s.range && ` · ${s.range}`}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {s.partList[0]?.id && (
              <Link
                href={`/sermon/${s.partList[0].id}`}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-sky"
              >
                Start with Part 1 <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
            <Link
              href={`/series/${s.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/40 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
            >
              Open the series
            </Link>
          </div>
        </div>
      </div>

      <ul className="custom-scrollbar relative flex gap-2 overflow-x-auto border-t border-white/10 px-5 py-4 sm:px-10">
        {s.partList.map((p) => (
          <li key={p.id || p.n} className="flex-shrink-0">
            <Link
              href={`/sermon/${p.id}`}
              className="flex w-56 items-center gap-2.5 rounded-xl border border-white/15 px-3 py-2.5 transition-colors hover:bg-white/10"
            >
              <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold tabular-nums">
                {p.n}
              </span>
              <span className="min-w-0 truncate text-sm text-white/85">{p.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* --------------------------------------------------------------- OPTION D
   Shelf. The hero is a heading plus a rail of the actual parts as cards —
   the same card the grid below already uses, just bigger. Nothing new is
   invented, and 3 parts or 13 parts look equally deliberate. */

function OptionD({ s }) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow>Latest series</Eyebrow>
          <h2 className="mt-2 font-display text-2xl font-medium leading-tight tracking-tight text-brand-ink sm:text-4xl">
            {s.title}
          </h2>
          <p className="mt-2 text-sm text-brand-gray">
            {s.parts} {s.parts === 1 ? "part" : "parts"}
            {s.range && ` · ${s.range}`}
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-3">
          {s.partList[0]?.id && (
            <Link
              href={`/sermon/${s.partList[0].id}`}
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
            >
              Start with Part 1 <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
          <Link
            href={`/series/${s.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-brand-navy/25 px-5 py-2.5 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-sky"
          >
            Open the series
          </Link>
        </div>
      </div>

      <ul className="custom-scrollbar -mx-2 mt-5 flex gap-3 overflow-x-auto px-2 pb-3">
        {s.partList.map((p) => (
          <li key={p.id || p.n} className="w-48 flex-shrink-0 sm:w-56">
            <Link
              href={`/sermon/${p.id}`}
              className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-inset ring-brand-navy/10 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_30px_50px_-30px_rgba(16,42,78,0.45)]"
            >
              <span className="relative block aspect-video w-full overflow-hidden bg-brand-deep">
                <DotGrid dark className="inset-0" />
                <YtThumb
                  ids={[p.id ? s.coverById?.[p.id] : null, ...s.covers]}
                  quality="mqdefault"
                  className="relative h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-brand-ink/80 text-xs font-bold tabular-nums text-white">
                  {p.n}
                </span>
              </span>
              <span className="block px-2.5 pb-2.5 pt-2">
                <span className="line-clamp-2 text-sm font-medium leading-snug text-brand-ink">{p.title}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ page */

const OPTIONS = [
  {
    key: "A",
    name: "Light card",
    note: "Same white-card language as the grid below. Cover contained, never blurred behind the words.",
    Render: OptionA,
  },
  {
    key: "B",
    name: "Editorial index",
    note: "Typographic. Art is a chip, so cover quality can't break it. Every part listed in full — reads as a syllabus.",
    Render: OptionB,
  },
  {
    key: "C",
    name: "Dark band, fixed",
    note: "Keeps the drama, but the background is brand navy + Vision decor instead of a crop of the artwork.",
    Render: OptionC,
  },
  {
    key: "D",
    name: "Shelf",
    note: "Heading + a rail of real part cards. Invents nothing new; 3 parts and 13 parts both look deliberate.",
    Render: OptionD,
  },
];

export default function HeroLabPage() {
  const [all, setAll] = useState(null);
  const [pick, setPick] = useState(0);

  useEffect(() => {
    document.title = "Hero lab · FaithHub";
    (async () => {
      const { data } = await supabase
        .from("series")
        .select("id, title, start_date, end_date, series_sermons ( part_number, sermons ( id, title, youtube_video_id ) )")
        .order("start_date", { ascending: false, nullsFirst: false });
      setAll(
        (data || []).map((s) => {
          const parts = [...(s.series_sermons || [])].sort((a, b) => a.part_number - b.part_number);
          const coverById = {};
          for (const p of parts) if (p.sermons?.id) coverById[p.sermons.id] = p.sermons.youtube_video_id;
          return {
            id: s.id,
            title: seriesName(s.title),
            range: fmtRange(s.start_date, s.end_date),
            parts: parts.length,
            partList: parts.map((p) => ({ n: p.part_number, id: p.sermons?.id, title: partTitle(p.sermons?.title, s.title) })),
            covers: parts.map((p) => p.sermons?.youtube_video_id).filter(Boolean),
            coverById,
          };
        })
      );
    })();
  }, []);

  // Quick jumps to the cases a hero usually breaks on.
  const stress = useMemo(() => {
    if (!all?.length) return [];
    const longest = (x) => Math.max(0, ...x.partList.map((p) => p.title?.length || 0));
    const by = (fn) => all.indexOf([...all].sort(fn)[0]);
    return [
      { label: "Newest (default)", i: 0 },
      { label: "Longest title", i: by((a, b) => b.title.length - a.title.length) },
      { label: "Most parts", i: by((a, b) => b.parts - a.parts) },
      { label: "Fewest parts", i: by((a, b) => a.parts - b.parts) },
      { label: "Longest part titles", i: by((a, b) => longest(b) - longest(a)) },
    ];
  }, [all]);

  const s = all?.[pick];

  return (
    <ToolShell kind="series" title="Series Study" titleAs="p">
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto max-w-[1400px] px-4 pb-32 pt-8 sm:px-8">
          <div className="rounded-2xl border border-dashed border-brand-navy/25 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-navy/60">Hero lab · scratch page</p>
            <p className="mt-1.5 text-sm text-brand-gray">
              Four candidates for the &ldquo;Latest series&rdquo; hero. Change the series and every option redraws &mdash; that&rsquo;s the
              test.
            </p>
            {all === null ? (
              <p className="mt-3 text-sm text-brand-gray">Loading the catalog&hellip;</p>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  value={pick}
                  onChange={(e) => setPick(Number(e.target.value))}
                  className="h-10 max-w-full rounded-full border border-brand-navy/20 bg-white px-4 text-base font-bold text-brand-ink focus:outline-none"
                >
                  {all.map((x, i) => (
                    <option key={x.id} value={i}>
                      {x.title} ({x.parts})
                    </option>
                  ))}
                </select>
                {stress.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => setPick(t.i)}
                    className={cn(
                      "rounded-full border px-3.5 py-2 text-xs font-bold transition-colors",
                      pick === t.i
                        ? "border-brand-navy bg-brand-navy text-white"
                        : "border-brand-navy/20 text-brand-navy hover:bg-brand-sky"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPick(Math.floor(Math.random() * all.length))}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-navy/20 px-3.5 py-2 text-xs font-bold text-brand-navy hover:bg-brand-sky"
                >
                  <Shuffle size={13} aria-hidden="true" /> Random
                </button>
              </div>
            )}
          </div>

          {s &&
            OPTIONS.map(({ key, name, note, Render }) => (
              <div key={key} className="mt-12">
                <div className="mb-3 flex items-baseline gap-3">
                  <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-brand-navy text-sm font-bold text-white">
                    {key}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-xl font-medium text-brand-ink">{name}</p>
                    <p className="mt-0.5 text-sm text-brand-gray">{note}</p>
                  </div>
                </div>
                <Render s={s} />
              </div>
            ))}
        </div>
      </div>
    </ToolShell>
  );
}
