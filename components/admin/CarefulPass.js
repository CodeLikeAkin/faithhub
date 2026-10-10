"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ClipboardCopy, Feather } from "lucide-react";
import YtThumb from "@/components/YtThumb";
import { Btn, Chip, Notice, TextArea } from "@/components/admin/controls";
import { fmtDate } from "@/lib/admin-format";
import { isDeadVideo } from "@/lib/admin-titles";
import { cn } from "@/lib/utils";

const BATCH_HINT = 12;

/** The instruction you paste into Claude Code, opened in the Faithhub folder. */
function buildPrompt(rows) {
  const lines = [
    `Run the FaithHub careful pass for the ${rows.length} ${rows.length === 1 ? "sermon" : "sermons"} below.`,
    "",
    "Work in .claude/faithhub-pipeline. Follow EXTRACTION-STANDARDS.md exactly: section 1 (the \"blend\" standard) for declarations and section 3 for study notes. Use at most 3 subagents at a time, each taking its sermons one after another, and check the database afterwards instead of trusting a subagent's own report.",
    "",
    "For each sermon:",
    "1. Read the transcript: node claude-extraction/fetch-sermon.js <sermon id>",
    "2. If it needs declarations: write the JSON array, then save it with",
    "   node claude-extraction/save-declarations.js <sermon id> <youtube id> <file.json>",
    "3. If it needs study notes: write the notes, then save them with",
    "   node claude-extraction/save-notes.js <sermon id> <file.md>",
    "Never run run-pipeline.js with --auto.",
    "",
    "Sermons:",
  ];
  for (const r of rows) {
    const needs = [r.needs_declarations && "declarations", r.needs_notes && "study notes"].filter(Boolean).join(" + ");
    const where = r.series_title ? ` (${r.series_title}${r.part_number ? `, part ${r.part_number}` : ""})` : " (not in a series)";
    lines.push(`- "${r.title}"${where}`);
    lines.push(`  sermon id: ${r.id}   youtube id: ${r.youtube_video_id}   needs: ${needs}`);
  }
  lines.push("", "When you're done, tell me which sermons were saved and how many declarations each got.");
  return lines.join("\n");
}

function Row({ r, checked, onToggle }) {
  const disabled = !r.has_transcript;
  return (
    <li className={cn("flex items-start gap-4 px-5 py-4 sm:px-6", disabled && "opacity-60")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        aria-label={`Include ${r.title}`}
        className="mt-1 h-5 w-5 flex-shrink-0 rounded border-slate-300 accent-brand-navy"
      />
      <div className="relative hidden aspect-video w-28 flex-shrink-0 overflow-hidden rounded-xl bg-brand-sky sm:block">
        <YtThumb ids={r.youtube_video_id} quality="mqdefault" className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-semibold leading-snug text-brand-ink">
          <Link href={`/admin/messages/${r.id}`} className="hover:text-brand-navy hover:underline focus-visible:underline focus-visible:outline-none">
            {r.title}
          </Link>
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {r.series_title ? `${r.series_title}${r.part_number ? `, part ${r.part_number}` : ""}` : "Not in a series"}
          {r.sermon_date ? `, uploaded ${fmtDate(r.sermon_date)}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {r.needs_declarations && <Chip tone="warn">Needs declarations</Chip>}
          {r.needs_notes && <Chip tone="warn">Needs study notes</Chip>}
          {r.published === false && <Chip tone="outline">Not published yet</Chip>}
          {isDeadVideo(r.video_status) && <Chip tone="bad">Video won&apos;t play</Chip>}
          {disabled && <Chip tone="bad">No transcript yet, process it first</Chip>}
        </div>
      </div>
    </li>
  );
}

const SHOW = 30;

function Section({ title, note, list, id, picked, setPicked, toggle }) {
  const [shown, setShown] = useState(SHOW);
  if (!list.length) return null;
  const ready = list.filter((r) => r.has_transcript);
  const left = ready.filter((r) => !picked.has(r.id));
  const visible = list.slice(0, shown);

  // Big lists are done a batch at a time, so offer the next batch, not "all",
  // and open the list far enough to show every message it ticks.
  const pickNext = () => {
    const batch = left.slice(0, BATCH_HINT);
    if (!batch.length) return;
    setPicked((p) => new Set([...p, ...batch.map((r) => r.id)]));
    setShown((s) => Math.max(s, list.indexOf(batch[batch.length - 1]) + 1));
  };
  const pickAll = () => setPicked((p) => new Set([...p, ...ready.map((r) => r.id)]));
  const clear = () => setPicked((p) => new Set([...p].filter((x) => !list.some((r) => r.id === x))));

  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-3xl border border-brand-navy/[0.07] bg-white shadow-[0_1px_2px_rgba(16,42,78,0.04)]">
      <header className="flex flex-wrap items-start justify-between gap-2 px-5 pt-5 sm:px-6">
        <div>
          <h2 id={id} className="text-lg font-bold text-brand-ink">
            {title} <span className="font-normal text-slate-500">({list.length})</span>
          </h2>
          {note && <p className="mt-1 text-sm text-slate-500">{note}</p>}
        </div>
        <div className="flex gap-1">
          {ready.length > BATCH_HINT ? (
            <Btn variant="ghost" size="sm" disabled={!left.length} onClick={pickNext}>
              Select next {Math.min(BATCH_HINT, left.length) || BATCH_HINT}
            </Btn>
          ) : (
            <Btn variant="ghost" size="sm" disabled={!left.length} onClick={pickAll}>
              Select all
            </Btn>
          )}
          <Btn variant="ghost" size="sm" onClick={clear}>
            Clear
          </Btn>
        </div>
      </header>
      <ul className="mt-2 divide-y divide-slate-100">
        {visible.map((r) => (
          <Row key={r.id} r={r} checked={picked.has(r.id)} onToggle={() => toggle(r.id)} />
        ))}
      </ul>
      {list.length > visible.length && (
        <div className="border-t border-slate-100 p-4 text-center">
          <Btn variant="secondary" size="sm" onClick={() => setShown((s) => s + SHOW)}>
            Show {Math.min(SHOW, list.length - visible.length)} more
          </Btn>
        </div>
      )}
    </section>
  );
}

function ScopeSwitch({ library }) {
  const item = (on) =>
    cn(
      "flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy",
      on ? "bg-brand-navy text-white" : "text-slate-600 hover:bg-brand-sky hover:text-brand-navy"
    );
  return (
    <nav aria-label="Which messages" className="flex gap-1 overflow-x-auto rounded-full bg-white p-1 ring-1 ring-brand-navy/[0.07] sm:w-fit">
      <Link href="/admin/careful-pass" aria-current={!library ? "page" : undefined} className={item(!library)}>
        Series and new messages
      </Link>
      <Link href="/admin/careful-pass?scope=library" aria-current={library ? "page" : undefined} className={item(library)}>
        Whole library
      </Link>
    </nav>
  );
}

export default function CarefulPass({ rows, library = false }) {
  // New messages first: they are hidden until published, so they wait on this pass.
  const waiting = useMemo(() => rows.filter((r) => r.published === false), [rows]);
  const live = useMemo(() => rows.filter((r) => r.published !== false), [rows]);
  const catalog = useMemo(() => live.filter((r) => r.in_catalog), [live]);
  const others = useMemo(() => live.filter((r) => !r.in_catalog && r.added_here), [live]);
  const rest = useMemo(() => live.filter((r) => !r.in_catalog && !r.added_here), [live]);
  const [picked, setPicked] = useState(
    () => new Set([...waiting, ...catalog].filter((r) => r.has_transcript).slice(0, BATCH_HINT).map((r) => r.id))
  );
  const [copied, setCopied] = useState(false);
  const [showText, setShowText] = useState(false);

  const chosen = rows.filter((r) => picked.has(r.id));
  const prompt = chosen.length ? buildPrompt(chosen) : "";

  const toggle = (id) =>
    setPicked((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setShowText(true); // clipboard blocked: show the text to copy by hand
    }
  }

  if (!rows.length) {
    return (
      <div className="space-y-6">
        <ScopeSwitch library={library} />
        <div className="rounded-3xl bg-white p-10 text-center ring-1 ring-brand-navy/[0.07]">
          <Feather size={22} aria-hidden="true" className="mx-auto text-brand-navy" />
          <p className="mt-3 text-lg font-bold text-brand-ink">Nothing waiting</p>
          <p className="mt-1 text-slate-500">
            {library
              ? "Every message has its declarations, and every series message its study notes."
              : "Every catalog message has its declarations and study notes."}
          </p>
        </div>
      </div>
    );
  }

  const sectionProps = { picked, setPicked, toggle };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <ScopeSwitch library={library} />
        <Section title="New, waiting to publish" note="Do these first: they go live once you publish them." list={waiting} id="cp-new" {...sectionProps} />
        <Section title="In the public catalog" list={catalog} id="cp-catalog" {...sectionProps} />
        <Section title="Added from this page, outside the catalog" list={others} id="cp-other" {...sectionProps} />
        {library && (
          <Section
            title="Rest of the library"
            note="Messages in no series. They only need declarations; study notes are for series messages. If one needs none, open it and mark it."
            list={rest}
            id="cp-rest"
            {...sectionProps}
          />
        )}
        {!library && (
          <p className="text-sm text-slate-500">
            Messages outside a series that were never added from this page are on the{" "}
            <Link href="/admin/careful-pass?scope=library" className="font-semibold text-brand-navy underline underline-offset-2">
              whole library
            </Link>{" "}
            list.
          </p>
        )}
      </div>

      <aside className="xl:col-span-1">
        <div className="sticky top-6 space-y-4 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-navy via-brand-deep to-[#0B1F3B] p-6 text-white shadow-[0_24px_48px_-24px_rgba(16,42,78,0.55)]">
          <h2 className="text-lg font-bold">Hand it to Claude</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-brand-mist">
            <li>Tick the messages to do. Around {BATCH_HINT} at a time works well.</li>
            <li>Copy the instructions.</li>
            <li>Open Claude Code in your Faithhub folder and paste them.</li>
          </ol>
          <p className="text-4xl font-bold">{chosen.length}</p>
          <p className="-mt-3 text-sm text-brand-mist">{chosen.length === 1 ? "message selected" : "messages selected"}</p>
          <Btn
            variant="secondary"
            className="w-full bg-white text-brand-navy ring-0"
            icon={copied ? Check : ClipboardCopy}
            disabled={!chosen.length}
            onClick={copy}
          >
            {copied ? "Copied" : "Copy instructions"}
          </Btn>
          <button
            type="button"
            className="text-sm font-semibold text-brand-mist underline underline-offset-2 hover:text-white disabled:opacity-50"
            disabled={!chosen.length}
            onClick={() => setShowText((s) => !s)}
          >
            {showText ? "Hide the text" : "Show the text"}
          </button>
          {showText && chosen.length > 0 && (
            <TextArea
              readOnly
              rows={10}
              value={prompt}
              aria-label="Instructions for Claude"
              onFocus={(e) => e.target.select()}
              className="bg-white/95 text-sm"
            />
          )}
        </div>
        <Notice tone="info" className="mt-4">
          This page refreshes the list each time you open it, so finished messages drop off on their own. Messages marked
          &ldquo;no declarations needed&rdquo; aren&apos;t listed.
        </Notice>
      </aside>
    </div>
  );
}
