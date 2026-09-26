"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, Link2, RefreshCw, Search, Sparkles, Youtube } from "lucide-react";
import YtThumb from "@/components/YtThumb";
import { Btn, Chip, ConfirmBtn, Field, Input, Notice, Select, TextArea } from "@/components/admin/controls";
import { adminFetch } from "@/lib/admin-client";
import { fmtDate, fmtDuration } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

const NONE = "";

/** Default choices for a freshly previewed video. */
function defaultsFor(item) {
  const blocked = !item.found || item.job_status;
  return {
    include: !blocked && !item.in_library && !item.short && item.own_channel !== false,
    series_id: item.suggestion?.series_id || NONE,
    part_number: item.suggestion?.part_number || "",
  };
}

function StatusChips({ item }) {
  const chips = [];
  if (item.job_status) chips.push(<Chip key="job" tone="warn">{item.job_status === "running" ? "Being processed now" : "Already waiting in the queue"}</Chip>);
  if (item.in_library)
    chips.push(
      <Chip key="lib" tone="outline">
        Already in the library
        {item.in_library.series_title ? `, in ${item.in_library.series_title}` : ", not in a series"}
      </Chip>
    );
  if (!item.in_library && !item.job_status) chips.push(<Chip key="new" tone="good">New</Chip>);
  if (item.short) chips.push(<Chip key="short" tone="warn">Short clip ({fmtDuration(item.duration_seconds)})</Chip>);
  if (item.live) chips.push(<Chip key="live" tone="warn">Live or upcoming, captions come later</Chip>);
  if (item.own_channel === false) chips.push(<Chip key="chan" tone="bad">Not from the church channel ({item.channel_title})</Chip>);
  return <div className="flex flex-wrap gap-1.5">{chips}</div>;
}

function PreviewCard({ item, choice, series, onChange }) {
  const idBase = `pv-${item.youtube_video_id}`;
  const suggestedId = item.suggestion?.series_id;
  // Suggested series first, then the rest alphabetically.
  const ordered = useMemo(() => {
    if (!suggestedId) return series;
    const s = series.find((x) => x.id === suggestedId);
    return s ? [s, ...series.filter((x) => x.id !== suggestedId)] : series;
  }, [series, suggestedId]);

  if (!item.found) {
    return (
      <li className="flex items-center gap-4 rounded-3xl border border-dashed border-slate-300 bg-white/60 p-4">
        <span className="flex h-12 w-20 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
          <Youtube size={20} aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold text-brand-ink">YouTube doesn&apos;t have this video</p>
          <p className="text-sm text-slate-500">
            {item.youtube_video_id}: it may be private, deleted, or the link was mistyped.
          </p>
        </div>
      </li>
    );
  }

  const locked = !!item.in_library?.series_title; // already placed; the worker never moves it
  const blocked = !!item.job_status;

  return (
    <li
      className={cn(
        "rounded-3xl border bg-white p-4 transition-shadow sm:p-5",
        choice.include ? "border-brand-navy/30 shadow-[0_12px_32px_-20px_rgba(16,42,78,0.35)]" : "border-brand-navy/[0.07]"
      )}
    >
      <div className="flex gap-4">
        <label className="mt-1 flex flex-shrink-0 cursor-pointer items-start" htmlFor={`${idBase}-inc`}>
          <input
            id={`${idBase}-inc`}
            type="checkbox"
            checked={choice.include}
            disabled={blocked}
            onChange={(e) => onChange({ include: e.target.checked })}
            className="h-5 w-5 rounded border-slate-300 text-brand-navy accent-brand-navy focus:ring-brand-navy"
          />
          <span className="sr-only">Add this message</span>
        </label>
        <div className="relative aspect-video w-28 flex-shrink-0 overflow-hidden rounded-xl bg-brand-sky sm:w-36">
          <YtThumb ids={item.youtube_video_id} quality="mqdefault" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-semibold leading-snug text-brand-ink">{item.title}</p>
          <p className="mt-1 text-sm text-slate-500">
            {[item.speaker, fmtDate(item.published_at), fmtDuration(item.duration_seconds)].filter(Boolean).join(", ")}
          </p>
          <div className="mt-2">
            <StatusChips item={item} />
          </div>
        </div>
      </div>

      {!blocked && (
        <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-[minmax(0,1fr)_140px]">
          <Field
            id={`${idBase}-series`}
            label="Series"
            hint={
              locked
                ? "It's already in this series and stays there."
                : item.suggestion?.close
                ? "A close match: the title names this series a little differently. Check it's right."
                : item.suggestion
                ? "Suggested from the title. Change it if it's wrong."
                : "No series matched the title. Pick one, or keep it out of the catalog."
            }
          >
            <Select
              id={`${idBase}-series`}
              value={locked ? "__locked" : choice.series_id}
              disabled={locked || !choice.include}
              onChange={(e) => {
                const id = e.target.value;
                const next = series.find((s) => s.id === id);
                onChange({
                  series_id: id,
                  part_number: id === item.suggestion?.series_id ? item.suggestion.part_number : next?.next_part || "",
                });
              }}
            >
              {locked && <option value="__locked">{item.in_library.series_title}</option>}
              <option value={NONE}>Not in a series (keeps it out of the catalog)</option>
              {ordered.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id === suggestedId ? `${s.title} (suggested)` : s.title}
                </option>
              ))}
            </Select>
          </Field>
          {!locked && choice.series_id && (
            <Field
              id={`${idBase}-part`}
              label="Part"
              hint={item.suggestion?.from_title && choice.series_id === suggestedId ? "From the title" : "Next free part"}
            >
              <Input
                id={`${idBase}-part`}
                type="number"
                inputMode="numeric"
                min={1}
                max={999}
                value={choice.part_number}
                disabled={!choice.include}
                onChange={(e) => onChange({ part_number: e.target.value === "" ? "" : Number(e.target.value) })}
              />
            </Field>
          )}
        </div>
      )}
    </li>
  );
}

function Candidates({ onPreview, previewing }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [checking, setChecking] = useState(false);
  const [picked, setPicked] = useState(() => new Set());

  const load = useCallback(async () => {
    try {
      const { candidates } = await adminFetch("/api/admin/candidates");
      setList(candidates);
      setError("");
    } catch (e) {
      setError(e.message);
      setList([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function refresh() {
    setChecking(true);
    setNote("");
    setError("");
    try {
      const r = await adminFetch("/api/admin/candidates", { method: "POST", body: { action: "refresh" } });
      setNote(
        r.added
          ? `Found ${r.added} new ${r.added === 1 ? "message" : "messages"}.`
          : `Nothing new in the last ${r.looked_at} uploads${r.clips ? ` (${r.clips} short clips ignored)` : ""}.`
      );
      await load();
    } catch (e) {
      setError(e.message);
    }
    setChecking(false);
  }

  async function dismiss(id) {
    try {
      await adminFetch("/api/admin/candidates", { method: "POST", body: { action: "dismiss", youtube_video_id: id } });
      setList((l) => l.filter((c) => c.youtube_video_id !== id));
      setPicked((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
    } catch (e) {
      setError(e.message);
    }
  }

  const toggle = (id) =>
    setPicked((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <section
      aria-labelledby="new-uploads"
      className="rounded-3xl border border-brand-navy/[0.07] bg-white shadow-[0_1px_2px_rgba(16,42,78,0.04),0_12px_32px_-18px_rgba(16,42,78,0.18)]"
    >
      <header className="flex items-start justify-between gap-3 px-6 pt-6">
        <div>
          <h2 id="new-uploads" className="text-lg font-bold text-brand-ink">New on YouTube</h2>
          <p className="mt-1 text-sm text-slate-500">Checked every night. Nothing is added until you choose it.</p>
        </div>
        <Btn variant="secondary" size="sm" icon={RefreshCw} busy={checking} onClick={refresh}>
          Check now
        </Btn>
      </header>

      <div className="space-y-3 px-6 pb-6 pt-4">
        <Notice tone="error">{error}</Notice>
        <Notice tone="info">{note}</Notice>

        {list === null ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-brand-sky/60 motion-safe:animate-pulse" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center">
            <Sparkles size={20} aria-hidden="true" className="mx-auto text-brand-navy" />
            <p className="mt-2 font-semibold text-brand-ink">You&apos;re all caught up</p>
            <p className="mt-1 text-sm text-slate-500">No new messages waiting. Press Check now after a service.</p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {list.map((c) => (
                <li key={c.youtube_video_id} className="flex items-start gap-3 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Choose ${c.title}`}
                    checked={picked.has(c.youtube_video_id)}
                    onChange={() => toggle(c.youtube_video_id)}
                    className="mt-1 h-5 w-5 flex-shrink-0 rounded border-slate-300 accent-brand-navy"
                  />
                  <div className="relative aspect-video w-20 flex-shrink-0 overflow-hidden rounded-lg bg-brand-sky">
                    <YtThumb ids={c.youtube_video_id} quality="mqdefault" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-brand-ink">{c.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {[fmtDate(c.published_at), c.duration_seconds ? fmtDuration(c.duration_seconds) : null].filter(Boolean).join(", ")}
                    </p>
                    <div className="mt-1.5 flex gap-1">
                      <Btn variant="ghost" size="sm" className="-ml-3" onClick={() => onPreview([c.youtube_video_id])}>
                        Preview
                      </Btn>
                      <ConfirmBtn variant="ghost" question="Hide it?" confirmLabel="Hide" onConfirm={() => dismiss(c.youtube_video_id)}>
                        Hide
                      </ConfirmBtn>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <Btn
              className="w-full"
              icon={ArrowRight}
              disabled={!picked.size}
              busy={previewing}
              onClick={() => onPreview([...picked])}
            >
              Preview {picked.size ? picked.size : ""} chosen
            </Btn>
          </>
        )}
      </div>
    </section>
  );
}

export default function AddSermons({ workerOnline }) {
  const [text, setText] = useState("");
  const [ids, setIds] = useState([]); // every video currently previewed
  const [preview, setPreview] = useState(null); // { items, series }
  const [choices, setChoices] = useState({});
  const [busy, setBusy] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  async function runPreview(nextIds, rawText) {
    setBusy(true);
    setError("");
    setDone(null);
    try {
      const body = rawText !== undefined ? rawText : nextIds.join("\n");
      const r = await adminFetch("/api/admin/preview", { method: "POST", body: { text: body } });
      const all = r.items.map((i) => i.youtube_video_id);
      setIds(all);
      setPreview(r);
      setChoices((prev) => {
        const next = {};
        for (const item of r.items) next[item.youtube_video_id] = prev[item.youtube_video_id] || defaultsFor(item);
        return next;
      });
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  const previewPasted = () => {
    const merged = [...ids.join("\n").split("\n").filter(Boolean), text].join("\n");
    runPreview(null, merged);
  };
  const previewIds = (more) => runPreview([...new Set([...ids, ...more])]);

  const chosen = preview ? preview.items.filter((i) => i.found && choices[i.youtube_video_id]?.include && !i.job_status) : [];
  const badPart = chosen.some((i) => {
    const c = choices[i.youtube_video_id];
    return c.series_id && !i.in_library?.series_title && !(Number.isInteger(c.part_number) && c.part_number > 0);
  });

  async function queue() {
    setQueueing(true);
    setError("");
    try {
      const items = chosen.map((i) => {
        const c = choices[i.youtube_video_id];
        const locked = !!i.in_library?.series_title;
        return {
          youtube_video_id: i.youtube_video_id,
          title: i.title,
          series_id: locked ? null : c.series_id || null,
          part_number: locked || !c.series_id ? null : c.part_number,
        };
      });
      const { results } = await adminFetch("/api/admin/jobs", { method: "POST", body: { items } });
      const okIds = new Set(results.filter((r) => r.ok).map((r) => r.youtube_video_id));
      const problems = results.filter((r) => !r.ok);
      setDone({ count: okIds.size, problems });
      const left = preview.items.filter((i) => !okIds.has(i.youtube_video_id));
      setPreview(left.length ? { ...preview, items: left } : null);
      setIds(left.map((i) => i.youtube_video_id));
      setText("");
    } catch (e) {
      setError(e.message);
    }
    setQueueing(false);
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        {!workerOnline && (
          <Notice tone="info">
            Your processing computer isn&apos;t connected right now. You can still add messages; they&apos;ll wait in the
            queue and start as soon as it connects.
          </Notice>
        )}

        <section
          aria-labelledby="paste-title"
          className="rounded-3xl border border-brand-navy/[0.07] bg-white p-6 shadow-[0_1px_2px_rgba(16,42,78,0.04),0_12px_32px_-18px_rgba(16,42,78,0.18)]"
        >
          <h2 id="paste-title" className="flex items-center gap-2 text-lg font-bold text-brand-ink">
            <Link2 size={18} aria-hidden="true" className="text-brand-navy" />
            Paste YouTube links
          </h2>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) previewPasted();
            }}
          >
            <Field id="links" label="Links" hint="One or more links, one per line. Up to 25 at a time.">
              <TextArea
                id="links"
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={"https://www.youtube.com/watch?v=...\nhttps://youtu.be/..."}
                aria-describedby="links-hint"
              />
            </Field>
            <Btn type="submit" icon={Search} busy={busy} disabled={!text.trim()}>
              Preview
            </Btn>
          </form>
        </section>

        <Notice tone="error">{error}</Notice>
        {done && (
          <Notice tone={done.count ? "success" : "error"}>
            {done.count > 0 && (
              <>
                {done.count} {done.count === 1 ? "message is" : "messages are"} in the queue. The processing computer picks
                them up within a minute.{" "}
                <Link href="/admin/processing" className="font-bold underline underline-offset-2">
                  Watch progress
                </Link>
              </>
            )}
            {done.problems.map((p) => (
              <span key={p.youtube_video_id} className="block">
                {p.youtube_video_id}: {p.error}
              </span>
            ))}
          </Notice>
        )}

        {busy && !preview && (
          <ul className="space-y-4" aria-busy="true" aria-label="Looking the links up">
            {[0, 1].map((i) => (
              <li key={i} className="h-44 rounded-3xl bg-white/70 ring-1 ring-brand-navy/[0.05] motion-safe:animate-pulse" />
            ))}
          </ul>
        )}

        {preview && (
          <section aria-labelledby="confirm-title" className={cn("space-y-4", busy && "opacity-60")}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="confirm-title" className="text-lg font-bold text-brand-ink">Check and confirm</h2>
                <p className="mt-1 text-sm text-slate-500">Tick what to add, and check each series and part number.</p>
              </div>
              <Btn variant="ghost" size="sm" onClick={() => { setPreview(null); setIds([]); }}>
                Clear
              </Btn>
            </div>

            <ul className="space-y-4">
              {preview.items.map((item) => (
                <PreviewCard
                  key={item.youtube_video_id}
                  item={item}
                  series={preview.series}
                  choice={choices[item.youtube_video_id] || defaultsFor(item)}
                  onChange={(patch) =>
                    setChoices((c) => ({ ...c, [item.youtube_video_id]: { ...c[item.youtube_video_id], ...patch } }))
                  }
                />
              ))}
            </ul>

            <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-3xl bg-brand-deep p-4 text-white shadow-[0_24px_48px_-20px_rgba(16,42,78,0.7)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="flex items-center gap-2 text-sm">
                <Clock size={16} aria-hidden="true" className="text-brand-mist" />
                {chosen.length
                  ? `${chosen.length} ${chosen.length === 1 ? "message" : "messages"} ready to add.`
                  : "Tick at least one message to add."}
                {badPart && <span className="font-semibold text-[#fab219]"> Give every series a part number.</span>}
              </p>
              <Btn
                variant="secondary"
                className="bg-white text-brand-navy ring-0"
                icon={ArrowRight}
                busy={queueing}
                disabled={!chosen.length || badPart}
                onClick={queue}
              >
                Add to the queue
              </Btn>
            </div>
          </section>
        )}
      </div>

      <div className="xl:col-span-1">
        <Candidates onPreview={previewIds} previewing={busy} />
      </div>
    </div>
  );
}
