"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardCopy, Feather } from "lucide-react";
import YtThumb from "@/components/YtThumb";
import { Btn, Chip, Notice, TextArea } from "@/components/admin/controls";
import { fmtDate } from "@/lib/admin-format";
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
        <p className="line-clamp-2 font-semibold leading-snug text-brand-ink">{r.title}</p>
        <p className="mt-1 text-sm text-slate-500">
          {r.series_title ? `${r.series_title}${r.part_number ? `, part ${r.part_number}` : ""}` : "Not in a series"}
          {r.sermon_date ? `, uploaded ${fmtDate(r.sermon_date)}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {r.needs_declarations && <Chip tone="warn">Needs declarations</Chip>}
          {r.needs_notes && <Chip tone="warn">Needs study notes</Chip>}
          {disabled && <Chip tone="bad">No transcript yet, process it first</Chip>}
        </div>
      </div>
    </li>
  );
}

export default function CarefulPass({ rows }) {
  const catalog = useMemo(() => rows.filter((r) => r.in_catalog), [rows]);
  const others = useMemo(() => rows.filter((r) => !r.in_catalog), [rows]);
  const [picked, setPicked] = useState(
    () => new Set(catalog.filter((r) => r.has_transcript).slice(0, BATCH_HINT).map((r) => r.id))
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
      <div className="rounded-3xl bg-white p-10 text-center ring-1 ring-brand-navy/[0.07]">
        <Feather size={22} aria-hidden="true" className="mx-auto text-brand-navy" />
        <p className="mt-3 text-lg font-bold text-brand-ink">Nothing waiting</p>
        <p className="mt-1 text-slate-500">Every catalog message has its declarations and study notes.</p>
      </div>
    );
  }

  const section = (title, list, id) =>
    list.length > 0 && (
      <section aria-labelledby={id} className="overflow-hidden rounded-3xl border border-brand-navy/[0.07] bg-white shadow-[0_1px_2px_rgba(16,42,78,0.04)]">
        <header className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 sm:px-6">
          <h2 id={id} className="text-lg font-bold text-brand-ink">
            {title} <span className="font-normal text-slate-500">({list.length})</span>
          </h2>
          <div className="flex gap-1">
            <Btn
              variant="ghost"
              size="sm"
              onClick={() => setPicked((p) => new Set([...p, ...list.filter((r) => r.has_transcript).map((r) => r.id)]))}
            >
              Select all
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => setPicked((p) => new Set([...p].filter((x) => !list.some((r) => r.id === x))))}>
              Clear
            </Btn>
          </div>
        </header>
        <ul className="mt-2 divide-y divide-slate-100">
          {list.map((r) => (
            <Row key={r.id} r={r} checked={picked.has(r.id)} onToggle={() => toggle(r.id)} />
          ))}
        </ul>
      </section>
    );

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        {section("In the public catalog", catalog, "cp-catalog")}
        {section("Added from this page, outside the catalog", others, "cp-other")}
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
          This page refreshes the list each time you open it, so finished messages drop off on their own.
        </Notice>
      </aside>
    </div>
  );
}
