"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Captions, ChevronRight, Eye, EyeOff, FileText, Flame, Languages, RotateCw, Search, X } from "lucide-react";
import YtThumb from "@/components/YtThumb";
import { Btn, Chip, ConfirmBtn, Input, Notice, Select } from "@/components/admin/controls";
import { adminFetch } from "@/lib/admin-client";
import { declarationState } from "@/lib/admin-format";
import { askStatus, isDeadVideo, preachedOn, speakerOf, splitTitle } from "@/lib/admin-titles";
import { cn } from "@/lib/utils";

const PAGE = 40;
const MAX_QUEUE = 25; // /api/admin/jobs takes up to 25 at a time
const nf = new Intl.NumberFormat("en-GB");
const fmt = (n) => nf.format(n);

// Who the list shows: the row of tiles.
const GROUPS = [
  { key: "all", label: "All messages", note: "Everything in the library", test: () => true },
  { key: "catalog", label: "In the public catalog", note: "In a series and published", test: (m) => !!m.series_id && m.published },
  { key: "unpublished", label: "Waiting to publish", note: "Hidden from the browse pages", test: (m) => !m.published },
  { key: "solo", label: "Outside a series", note: "Reached through Ask and search", test: (m) => !m.series_id },
];

// What needs work: one at a time. Study notes are only wanted in a series.
const PROBLEMS = [
  { key: "transcript", label: "No transcript", test: (m) => !m.transcript },
  { key: "search", label: "Not searchable", test: (m) => !m.search },
  { key: "scriptures", label: "No scripture list", test: (m) => !m.scriptures },
  { key: "declarations", label: "No declarations", test: (m) => declarationState(m) === "missing" },
  { key: "notes", label: "No study notes", test: (m) => !!m.series_id && !m.notes },
  { key: "words", label: "No word studies", test: (m) => !m.word_studies && !m.word_studies_none },
  { key: "video", label: "Video won't play", test: (m) => isDeadVideo(m.video_status) },
];

const SORTS = [
  { key: "newest", label: "Newest upload first" },
  { key: "oldest", label: "Oldest upload first" },
  { key: "title", label: "Title, A to Z" },
  { key: "gaps", label: "Most pieces missing first" },
];

/** The six study pieces, each "have", "none" (checked, none needed), "na" / "kept" (not wanted here) or "missing". */
function piecesOf(m) {
  return [
    { key: "transcript", label: "Transcript", icon: Captions, state: m.transcript ? "have" : "missing" },
    { key: "search", label: "Searchable in Ask the Word", icon: Search, state: m.search ? "have" : "missing" },
    { key: "scriptures", label: "Scripture list", icon: BookOpen, count: m.scriptures, state: m.scriptures ? "have" : "missing" },
    {
      key: "words",
      label: "Word studies",
      icon: Languages,
      count: m.word_studies,
      state: m.word_studies ? "have" : m.word_studies_none ? "none" : "missing",
    },
    { key: "declarations", label: "Declarations", icon: Flame, count: m.declarations, state: declarationState(m) },
    { key: "notes", label: "Study notes", icon: FileText, state: m.notes ? "have" : m.series_id ? "missing" : "na" },
  ];
}

const missingCount = (m) => piecesOf(m).filter((p) => p.state === "missing").length;

const STATE_TEXT = {
  have: "in place",
  none: "checked, none needed",
  na: "not needed outside a series",
  kept: "kept off the Declarations page (guest or celebration video)",
  missing: "missing",
};

function Pieces({ m }) {
  const pieces = piecesOf(m);
  const missing = pieces.filter((p) => p.state === "missing").length;
  return (
    <div className="flex items-center gap-3">
      <ul className="flex gap-1.5">
        {pieces.map(({ key, label, icon: Icon, state, count }) => {
          const text = `${label}: ${STATE_TEXT[state]}${state === "have" && count ? ` (${fmt(count)})` : ""}`;
          return (
            <li
              key={key}
              title={text}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full",
                // Navy means nothing to do: it has it, or it isn't needed. The tooltip says which.
                state !== "missing" && "bg-brand-navy text-white",
                state === "missing" && "border border-dashed border-slate-300 text-slate-400"
              )}
            >
              <Icon size={13} aria-hidden="true" />
              <span className="sr-only">{text}</span>
            </li>
          );
        })}
      </ul>
      <span className={cn("w-[4.75rem] whitespace-nowrap text-xs font-semibold", missing ? "text-slate-600" : "text-[#0a6b0a]")}>
        {missing ? `${missing} missing` : "All in place"}
      </span>
    </div>
  );
}

function Legend() {
  const items = [
    ["Transcript", Captions],
    ["Searchable", Search],
    ["Scriptures", BookOpen],
    ["Word studies", Languages],
    ["Declarations", Flame],
    ["Study notes", FileText],
  ];
  return (
    <ul className="hidden flex-wrap items-center gap-x-4 gap-y-1 xl:flex" aria-label="Piece icons">
      {items.map(([label, Icon]) => (
        <li key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
          <Icon size={13} aria-hidden="true" className="text-brand-navy" />
          {label}
        </li>
      ))}
    </ul>
  );
}

const JOB = {
  queued: { tone: "warn", text: "In the processing queue" },
  running: { tone: "warn", text: "Processing now" },
  failed: { tone: "bad", text: "Last processing run failed" },
};

function Row({ m, checked, onToggle }) {
  const { title, context } = splitTitle(m.title);
  const meta = [speakerOf(m.title), preachedOn(m)].filter(Boolean).join(", ");
  const job = JOB[m.job_status];
  // Guests and celebration videos are kept out of Ask the Word and Declarations;
  // an unnamed title (counted as Dad) is only worth a look before it goes live.
  const ask = askStatus(m.title);
  const askChip = ask && (ask.kind !== "unnamed" || !m.published) ? ask : null;
  return (
    <li className="grid grid-cols-[auto_88px_minmax(0,1fr)] items-start gap-x-4 gap-y-3 px-4 py-4 transition-colors hover:bg-brand-sky/40 sm:grid-cols-[auto_128px_minmax(0,1fr)] sm:px-6 xl:grid-cols-[auto_128px_minmax(0,1fr)_auto] xl:items-center xl:gap-x-6">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        aria-label={`Select ${title}`}
        className="mt-1 h-5 w-5 rounded border-slate-300 accent-brand-navy xl:mt-0"
      />
      <Link href={`/admin/messages/${m.id}`} tabIndex={-1} aria-hidden="true" className="relative block aspect-video overflow-hidden rounded-xl bg-brand-sky">
        <YtThumb ids={m.youtube_video_id} quality="mqdefault" className="h-full w-full object-cover" />
      </Link>
      <div className="min-w-0">
        <p className="line-clamp-2 font-semibold leading-snug text-brand-ink">
          <Link href={`/admin/messages/${m.id}`} className="hover:text-brand-navy hover:underline focus-visible:underline focus-visible:outline-none">
            {title}
          </Link>
          {context && <span className="font-normal text-slate-500"> {context}</span>}
        </p>
        {meta && <p className="mt-1 truncate text-sm text-slate-500">{meta}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {m.series_id ? (
            <Chip>
              {m.series_title}
              {m.part_number ? `, part ${m.part_number}` : ""}
              {m.series_links > 1 ? ` (+${m.series_links - 1} more)` : ""}
            </Chip>
          ) : (
            <Chip tone="outline">Not in a series</Chip>
          )}
          {!m.published && <Chip tone="warn">Waiting to publish</Chip>}
          {askChip && <Chip tone={askChip.kind === "unnamed" ? "outline" : "warn"}>{askChip.text}</Chip>}
          {isDeadVideo(m.video_status) && <Chip tone="bad">Video won&apos;t play</Chip>}
          {job && <Chip tone={job.tone}>{job.text}</Chip>}
        </div>
      </div>
      <div className="col-span-3 flex items-center justify-between gap-3 pl-9 sm:pl-[11.25rem] xl:col-span-1 xl:pl-0">
        <Pieces m={m} />
        <Link
          href={`/admin/messages/${m.id}`}
          aria-label={`Open ${title}`}
          className="hidden h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-brand-sky hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy sm:flex"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </li>
  );
}

function sortRows(list, sort) {
  const out = [...list];
  if (sort === "oldest") out.reverse(); // the server sends newest first
  else if (sort === "title") out.sort((a, b) => splitTitle(a.title).title.localeCompare(splitTitle(b.title).title));
  else if (sort === "gaps") out.sort((a, b) => missingCount(b) - missingCount(a));
  return out;
}

export default function MessagesBoard({ messages, initial }) {
  const [rows, setRows] = useState(messages);
  const [group, setGroup] = useState(GROUPS.some((g) => g.key === initial.filter) ? initial.filter : "all");
  const [problem, setProblem] = useState(PROBLEMS.some((p) => p.key === initial.missing) ? initial.missing : null);
  const [q, setQ] = useState(initial.q || "");
  const [sort, setSort] = useState(SORTS.some((s) => s.key === initial.sort) ? initial.sort : "newest");
  const [shown, setShown] = useState(PAGE);
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState(null);

  // Keep the address bar in step, so a view can be bookmarked or linked to.
  useEffect(() => {
    const u = new URL(window.location.href);
    const set = (k, v) => (v ? u.searchParams.set(k, v) : u.searchParams.delete(k));
    set("filter", group === "all" ? "" : group);
    set("missing", problem || "");
    set("q", q.trim());
    set("sort", sort === "newest" ? "" : sort);
    window.history.replaceState(null, "", u);
  }, [group, problem, q, sort]);

  // A new view starts at the top with nothing ticked.
  useEffect(() => {
    setShown(PAGE);
    setPicked(new Set());
  }, [group, problem, q, sort]);

  const groupCounts = useMemo(() => Object.fromEntries(GROUPS.map((g) => [g.key, rows.filter(g.test).length])), [rows]);
  const inGroup = useMemo(() => rows.filter(GROUPS.find((g) => g.key === group).test), [rows, group]);
  const problemCounts = useMemo(() => Object.fromEntries(PROBLEMS.map((p) => [p.key, inGroup.filter(p.test).length])), [inGroup]);

  const list = useMemo(() => {
    let out = problem ? inGroup.filter(PROBLEMS.find((p) => p.key === problem).test) : inGroup;
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length) {
      out = out.filter((m) => {
        const hay = `${m.title} ${m.series_title || ""} ${m.youtube_video_id || ""}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      });
    }
    return sortRows(out, sort);
  }, [inGroup, problem, q, sort]);

  const visible = list.slice(0, shown);
  const chosen = rows.filter((m) => picked.has(m.id));
  const toPublish = chosen.filter((m) => !m.published);
  const toHide = chosen.filter((m) => m.published);
  const allVisiblePicked = visible.length > 0 && visible.every((m) => picked.has(m.id));

  const toggle = (id) =>
    setPicked((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleVisible = () =>
    setPicked((p) => {
      const n = new Set(p);
      if (allVisiblePicked) visible.forEach((m) => n.delete(m.id));
      else visible.forEach((m) => n.add(m.id));
      return n;
    });

  async function setPublished(target, published) {
    setBusy(published ? "publish" : "hide");
    setNotice(null);
    try {
      const r = await adminFetch("/api/admin/sermons/publish", {
        method: "POST",
        body: { ids: target.map((m) => m.id), published },
      });
      const changed = new Set(r.changed);
      setRows((all) => all.map((m) => (changed.has(m.id) ? { ...m, published } : m)));
      setPicked(new Set());
      const n = changed.size;
      const what = `${fmt(n)} ${n === 1 ? "message" : "messages"}`;
      const series = r.summaries_cleared?.length
        ? ` The summary of ${r.summaries_cleared.map((t) => `"${t}"`).join(", ")} will be rewritten the next time someone opens it.`
        : "";
      setNotice({ tone: "success", text: `${published ? "Published" : "Hid"} ${what}.${series}` });
    } catch (e) {
      setNotice({ tone: "error", text: e.message });
    }
    setBusy("");
  }

  async function processAgain() {
    setBusy("queue");
    setNotice(null);
    try {
      const items = chosen.map((m) => ({ youtube_video_id: m.youtube_video_id, title: m.title, series_id: null, part_number: null }));
      const { results } = await adminFetch("/api/admin/jobs", { method: "POST", body: { items } });
      const okIds = new Set(results.filter((r) => r.ok).map((r) => r.youtube_video_id));
      setRows((all) => all.map((m) => (okIds.has(m.youtube_video_id) ? { ...m, job_status: "queued" } : m)));
      setPicked(new Set());
      const problems = results.filter((r) => !r.ok);
      setNotice({
        tone: okIds.size ? "success" : "error",
        text:
          (okIds.size
            ? `${fmt(okIds.size)} queued for processing. The processing computer picks them up at its next check, within half an hour. Series links stay as they are.`
            : "Nothing was queued.") + (problems.length ? ` ${problems.length} skipped: ${problems[0].error}` : ""),
      });
    } catch (e) {
      setNotice({ tone: "error", text: e.message });
    }
    setBusy("");
  }

  const clearFilters = () => {
    setGroup("all");
    setProblem(null);
    setQ("");
  };

  return (
    <div className="space-y-6">
      {/* Who */}
      <div role="group" aria-label="Show" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {GROUPS.map((g) => {
          const on = group === g.key;
          const count = groupCounts[g.key];
          return (
            <button
              key={g.key}
              type="button"
              aria-pressed={on}
              onClick={() => setGroup(g.key)}
              className={cn(
                "group relative overflow-hidden rounded-3xl p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 sm:p-5",
                on
                  ? "bg-gradient-to-br from-brand-navy via-brand-deep to-[#0B1F3B] text-white shadow-[0_18px_40px_-22px_rgba(16,42,78,0.7)]"
                  : "border border-brand-navy/[0.07] bg-white text-brand-ink shadow-[0_1px_2px_rgba(16,42,78,0.04)] hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-20px_rgba(16,42,78,0.35)]"
              )}
            >
              <span className={cn("block text-sm font-semibold", on ? "text-brand-mist" : "text-slate-600")}>{g.label}</span>
              <span className="mt-2 block text-3xl font-bold tracking-tight sm:text-4xl">{fmt(count)}</span>
              <span className={cn("mt-1 block text-xs", on ? "text-brand-mist/90" : "text-slate-500")}>
                {g.key === "unpublished" && count > 0 ? "Publish them when they're ready" : g.note}
              </span>
              {g.key === "unpublished" && count > 0 && !on && (
                <span className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-[#fab219] ring-4 ring-[#fab219]/20" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {/* What needs work */}
      <div className="rounded-3xl border border-brand-navy/[0.07] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,78,0.04)] sm:p-5">
        <p className="text-sm font-semibold text-brand-ink">Needs work</p>
        <div role="group" aria-label="Needs work" className="mt-3 flex flex-wrap gap-2">
          {PROBLEMS.map((p) => {
            const on = problem === p.key;
            const n = problemCounts[p.key];
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={on}
                disabled={!n && !on}
                onClick={() => setProblem(on ? null : p.key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy disabled:cursor-default disabled:opacity-45",
                  on ? "bg-brand-navy text-white" : "bg-brand-sky/70 text-brand-navy hover:bg-brand-sky"
                )}
              >
                {p.label}
                <span className={cn("rounded-full px-1.5 text-xs tabular-nums", on ? "bg-white/20" : "bg-white text-slate-600")}>{fmt(n)}</span>
                {on && <X size={14} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      <section
        aria-label="Messages"
        className="overflow-hidden rounded-3xl border border-brand-navy/[0.07] bg-white shadow-[0_1px_2px_rgba(16,42,78,0.04),0_12px_32px_-18px_rgba(16,42,78,0.18)]"
      >
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              maxLength={100}
              aria-label="Find a message by title, series or YouTube id"
              placeholder="Find by title, series or YouTube id"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="msg-sort" className="whitespace-nowrap text-sm font-medium text-slate-600">
              Sort
            </label>
            <Select id="msg-sort" value={sort} onChange={(e) => setSort(e.target.value)} className="py-2 lg:w-64">
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={allVisiblePicked}
              onChange={toggleVisible}
              disabled={!visible.length}
              className="h-5 w-5 rounded border-slate-300 accent-brand-navy"
            />
            <span aria-live="polite">
              Showing <span className="font-semibold text-brand-ink">{fmt(visible.length)}</span> of{" "}
              <span className="font-semibold text-brand-ink">{fmt(list.length)}</span>
            </span>
          </label>
          <Legend />
        </div>

        {notice && (
          <div className="px-4 pb-3 sm:px-6">
            <Notice tone={notice.tone}>{notice.text}</Notice>
          </div>
        )}

        {visible.length ? (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {visible.map((m) => (
              <Row key={m.id} m={m} checked={picked.has(m.id)} onToggle={() => toggle(m.id)} />
            ))}
          </ul>
        ) : (
          <div className="border-t border-slate-100 px-6 py-14 text-center">
            <p className="text-lg font-bold text-brand-ink">No messages match</p>
            <p className="mt-1 text-slate-500">Try another word, or clear the filters.</p>
            <Btn variant="secondary" size="sm" className="mt-4" onClick={clearFilters}>
              Clear filters
            </Btn>
          </div>
        )}

        {list.length > visible.length && (
          <div className="border-t border-slate-100 p-4 text-center">
            <Btn variant="secondary" onClick={() => setShown((s) => s + PAGE)}>
              Show {fmt(Math.min(PAGE, list.length - visible.length))} more
            </Btn>
          </div>
        )}
      </section>

      {chosen.length > 0 && (
        <div
          role="region"
          aria-label="Selected messages"
          className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-3xl bg-brand-deep p-4 text-white shadow-[0_24px_48px_-20px_rgba(16,42,78,0.7)] sm:px-6 lg:flex-row lg:items-center lg:justify-between"
        >
          <p className="text-sm">
            <span className="font-bold">{fmt(chosen.length)}</span> selected
            {chosen.length > MAX_QUEUE && <span className="text-brand-mist">. Process up to {MAX_QUEUE} at a time.</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {toPublish.length > 0 && (
              <ConfirmBtn
                variant="primary"
                size="sm"
                onDark
                icon={Eye}
                className="bg-white text-brand-navy shadow-none hover:bg-brand-sky focus-visible:ring-white"
                question={`Publish ${fmt(toPublish.length)} on the live site?`}
                confirmLabel="Publish"
                busy={busy === "publish"}
                onConfirm={() => setPublished(toPublish, true)}
              >
                Publish {fmt(toPublish.length)}
              </ConfirmBtn>
            )}
            {toHide.length > 0 && (
              <ConfirmBtn
                variant="dangerSoft"
                size="sm"
                onDark
                icon={EyeOff}
                className="text-white ring-white/30 hover:bg-white/10 focus-visible:ring-white"
                question={`Hide ${fmt(toHide.length)} from the browse pages?`}
                confirmLabel="Hide"
                busy={busy === "hide"}
                onConfirm={() => setPublished(toHide, false)}
              >
                Hide {fmt(toHide.length)}
              </ConfirmBtn>
            )}
            <Btn
              variant="ghost"
              size="sm"
              icon={RotateCw}
              className="text-white ring-1 ring-inset ring-white/30 hover:bg-white/10"
              busy={busy === "queue"}
              disabled={chosen.length > MAX_QUEUE}
              onClick={processAgain}
            >
              Process again
            </Btn>
            <Btn variant="ghost" size="sm" className="text-brand-mist hover:bg-white/10 hover:text-white" onClick={() => setPicked(new Set())}>
              Clear
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
