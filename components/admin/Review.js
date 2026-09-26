"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ChevronDown, Eye, History, Pencil, PlayCircle, Save, Search } from "lucide-react";
import YtThumb from "@/components/YtThumb";
import { Btn, Chip, ConfirmBtn, Field, Input, Notice, TextArea } from "@/components/admin/controls";
import { THEMES } from "@/lib/declarations";
import { adminFetch } from "@/lib/admin-client";
import { fmtDate, timeAgo } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "declarations", label: "Declarations" },
  { key: "words", label: "Word studies" },
  { key: "notes", label: "Study notes" },
  { key: "history", label: "History" },
];

const card = "rounded-3xl border border-brand-navy/[0.07] bg-white shadow-[0_1px_2px_rgba(16,42,78,0.04)]";

// Same styles as the lesson page's notes (components/lesson/LessonPage.js
// NOTES_MARKDOWN), so the preview looks exactly like what visitors see.
const NOTES_MARKDOWN = {
  h1: ({ node, ...props }) => <h3 className="mb-2 mt-8 font-display text-2xl font-medium text-brand-ink first:mt-0" {...props} />,
  h2: ({ node, ...props }) => <h3 className="mb-2 mt-8 font-display text-2xl font-medium text-brand-ink first:mt-0" {...props} />,
  h3: ({ node, ...props }) => <h4 className="mb-2 mt-6 font-display text-xl font-medium text-brand-ink first:mt-0" {...props} />,
  p: ({ node, ...props }) => <p className="mb-4 last:mb-0" {...props} />,
  strong: ({ node, ...props }) => <strong className="font-semibold text-brand-ink" {...props} />,
  ul: ({ node, ...props }) => <ul className="my-4 list-disc space-y-2 pl-6 marker:text-brand-navy/50" {...props} />,
  ol: ({ node, ...props }) => <ol className="my-4 list-decimal space-y-2 pl-6 marker:text-brand-navy/70" {...props} />,
  blockquote: ({ node, ...props }) => (
    <blockquote className="my-5 rounded-r-2xl border-l-2 border-brand-navy/40 bg-brand-sky/50 py-3 pl-5 pr-4 font-display text-lg italic text-brand-ink" {...props} />
  ),
};
const clock = (s) => {
  const t = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

// ─── Picking a message ─────────────────────────────────────────────────────

function SermonPicker({ sermon, onPick }) {
  const [open, setOpen] = useState(!sermon);
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const r = await adminFetch(`/api/admin/sermons?q=${encodeURIComponent(q.trim())}`);
        setResults(r.sermons);
        setError("");
      } catch (e) {
        setError(e.message);
      }
    }, 300);
    return () => clearTimeout(timer.current);
  }, [q]);

  if (sermon && !open) {
    return (
      <div className={cn(card, "flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5")}>
        <div className="relative aspect-video w-full flex-shrink-0 overflow-hidden rounded-xl bg-brand-sky sm:w-40">
          <YtThumb ids={sermon.youtube_video_id} quality="mqdefault" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-500">Reviewing</p>
          <p className="line-clamp-2 text-lg font-bold leading-snug text-brand-ink">{sermon.title}</p>
          <p className="mt-1 text-sm text-slate-500">
            {sermon.series ? `${sermon.series.title}, part ${sermon.series.part_number}` : "Not in a series"}
            {sermon.sermon_date ? `, uploaded ${fmtDate(sermon.sermon_date)}` : ""}
          </p>
        </div>
        <Btn variant="secondary" size="sm" icon={Search} onClick={() => setOpen(true)}>
          Choose another
        </Btn>
      </div>
    );
  }

  return (
    <div className={cn(card, "space-y-4 p-6")}>
      <Field id="review-search" label="Which message?" hint="Type words from its YouTube title.">
        <Input id="review-search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Enlarged Day 2" />
      </Field>
      <Notice tone="error">{error}</Notice>
      {results &&
        (results.length ? (
          <ul className="divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-200">
            {results.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(s);
                    setOpen(false);
                    setQ("");
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-brand-sky/50 focus-visible:bg-brand-sky/50 focus-visible:outline-none"
                >
                  <div className="relative aspect-video w-20 flex-shrink-0 overflow-hidden rounded-lg bg-brand-sky">
                    <YtThumb ids={s.youtube_video_id} quality="mqdefault" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold text-brand-ink">{s.title}</p>
                    <p className="text-xs text-slate-500">
                      {s.series ? `${s.series.title}, part ${s.series.part_number}` : "Not in a series"}, {fmtDate(s.sermon_date)}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No message matches that.</p>
        ))}
      {sermon && (
        <Btn variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Keep reviewing the current message
        </Btn>
      )}
    </div>
  );
}

// ─── Declarations ──────────────────────────────────────────────────────────

function DeclarationRow({ d, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(d.declaration_text);
  const [tags, setTags] = useState(d.topic_tags || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      const r = await adminFetch(`/api/admin/declarations/${d.id}`, { method: "PATCH", body: { declaration_text: text, topic_tags: tags } });
      onSaved(r.declaration);
      setEditing(false);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/declarations/${d.id}`, { method: "DELETE" });
      onDeleted(d.id);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <li className="px-5 py-4 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <a
          href={d.youtube_url_with_timestamp}
          target="_blank"
          rel="noopener"
          className="inline-flex w-fit flex-shrink-0 items-center gap-1.5 rounded-full bg-brand-sky px-2.5 py-1 text-xs font-bold tabular-nums text-brand-navy hover:bg-brand-mist"
          title="Hear it in the message"
        >
          <PlayCircle size={14} aria-hidden="true" />
          {clock(d.timestamp_seconds)}
        </a>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-3">
              <Field id={`dt-${d.id}`} label="Declaration" error={error}>
                <TextArea id={`dt-${d.id}`} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
              </Field>
              <fieldset>
                <legend className="text-sm font-semibold text-brand-ink">Themes</legend>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {THEMES.map((t) => {
                    const on = tags.includes(t.slug);
                    return (
                      <button
                        key={t.slug}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setTags((x) => (on ? x.filter((y) => y !== t.slug) : [...x, t.slug]))}
                        className={cn(
                          "rounded-full px-3 py-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy",
                          on ? "bg-brand-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-brand-sky"
                        )}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <div className="flex flex-wrap gap-2">
                <Btn size="sm" icon={Save} busy={busy} disabled={!tags.length} onClick={save}>
                  Save
                </Btn>
                <Btn
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setText(d.declaration_text);
                    setTags(d.topic_tags || []);
                    setError("");
                  }}
                >
                  Cancel
                </Btn>
              </div>
            </div>
          ) : (
            <>
              <p className="leading-relaxed text-brand-ink">{d.declaration_text}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(d.topic_tags || []).map((t) => (
                  <Chip key={t}>{THEMES.find((x) => x.slug === t)?.name || t}</Chip>
                ))}
              </div>
              {error && <Notice tone="error" className="mt-2">{error}</Notice>}
            </>
          )}
        </div>
        {!editing && (
          <div className="flex flex-shrink-0 flex-wrap gap-2">
            <Btn variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(true)}>
              Edit
            </Btn>
            <ConfirmBtn question="Delete it?" confirmLabel="Delete" busy={busy} onConfirm={remove}>
              Delete
            </ConfirmBtn>
          </div>
        )}
      </div>
    </li>
  );
}

function Declarations({ sermon }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    let live = true;
    setList(null);
    adminFetch(`/api/admin/declarations?sermon_id=${sermon.id}`)
      .then((r) => live && setList(r.declarations))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [sermon.id]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!list) return <div className="h-48 rounded-3xl bg-white/70 motion-safe:animate-pulse" aria-busy="true" />;
  if (!list.length) {
    return (
      <div className={cn(card, "p-8 text-center")}>
        <p className="font-semibold text-brand-ink">No declarations for this message yet</p>
        <p className="mt-1 text-sm text-slate-500">They come from the careful pass. See the Careful pass page.</p>
      </div>
    );
  }
  return (
    <section className={card} aria-label="Declarations">
      <header className="flex flex-wrap items-center justify-between gap-2 px-6 pt-5">
        <p className="text-sm text-slate-500">
          {list.length} declarations, in the order they were spoken. Editing the wording keeps it searchable.
        </p>
        {saved && <Chip tone="good">{saved}</Chip>}
      </header>
      <ul className="mt-2 divide-y divide-slate-100">
        {list.map((d) => (
          <DeclarationRow
            key={d.id}
            d={d}
            onSaved={(nd) => {
              setList((l) => l.map((x) => (x.id === nd.id ? { ...x, ...nd } : x)));
              setSaved("Saved");
              setTimeout(() => setSaved(""), 2500);
            }}
            onDeleted={(id) => setList((l) => l.filter((x) => x.id !== id))}
          />
        ))}
      </ul>
    </section>
  );
}

// ─── Word studies ──────────────────────────────────────────────────────────

function WordRow({ w, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [meaning, setMeaning] = useState(w.meaning || "");
  const [note, setNote] = useState(w.note || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      const r = await adminFetch(`/api/admin/word-studies/${w.id}`, { method: "PATCH", body: { meaning, note } });
      onSaved(r.word);
      setEditing(false);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }
  async function remove() {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/word-studies/${w.id}`, { method: "DELETE" });
      onDeleted(w.id);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  const lang = String(w.language || "").toLowerCase();
  const langName = lang ? lang[0].toUpperCase() + lang.slice(1) : "";
  const langCode = { greek: "el", hebrew: "he", aramaic: "arc" }[lang];

  return (
    <li className="px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-xl font-bold text-brand-ink">{w.word}</span>
            {w.original_script && (
              <span className="font-display text-xl text-brand-navy" lang={langCode}>
                {w.original_script}
              </span>
            )}
            <span className="text-sm text-slate-500">
              {[langName, w.strongs_number, w.reference].filter(Boolean).join(", ")}
            </span>
          </p>
          {w.note && !editing && (
            <p className="mt-2 inline-flex items-start gap-2 rounded-2xl bg-[#fab219]/15 px-3 py-2 text-sm text-[#5c3b00]">
              <span className="font-bold">Reviewer note:</span> {w.note}
            </p>
          )}
        </div>
        {!editing && (
          <div className="flex flex-shrink-0 flex-wrap gap-2">
            <Btn variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(true)}>
              Edit
            </Btn>
            <ConfirmBtn question="Delete it?" confirmLabel="Delete" busy={busy} onConfirm={remove}>
              Delete
            </ConfirmBtn>
          </div>
        )}
      </div>
      {editing ? (
        <div className="mt-3 space-y-3">
          <Field id={`wm-${w.id}`} label="Meaning" error={error}>
            <TextArea id={`wm-${w.id}`} rows={4} value={meaning} onChange={(e) => setMeaning(e.target.value)} />
          </Field>
          <Field id={`wn-${w.id}`} label="Reviewer note" hint="Visible only here. Leave empty when nothing needs flagging.">
            <TextArea id={`wn-${w.id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Btn size="sm" icon={Save} busy={busy} onClick={save}>
              Save
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => { setEditing(false); setMeaning(w.meaning || ""); setNote(w.note || ""); setError(""); }}>
              Cancel
            </Btn>
          </div>
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{w.meaning}</p>
      )}
      {error && !editing && <Notice tone="error" className="mt-2">{error}</Notice>}
    </li>
  );
}

function WordStudies({ sermon }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setList(null);
    adminFetch(`/api/admin/word-studies?sermon_id=${sermon.id}`)
      .then((r) => live && setList(r.words))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [sermon.id]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!list) return <div className="h-48 rounded-3xl bg-white/70 motion-safe:animate-pulse" aria-busy="true" />;
  if (!list.length) {
    return (
      <div className={cn(card, "p-8 text-center")}>
        <p className="font-semibold text-brand-ink">No word studies for this message</p>
        <p className="mt-1 text-sm text-slate-500">Many messages don&apos;t explain a Greek or Hebrew word, and that&apos;s fine.</p>
      </div>
    );
  }
  return (
    <section className={card} aria-label="Word studies">
      <p className="px-6 pt-5 text-sm text-slate-500">
        Delete any word the preacher didn&apos;t actually explain. Check each one against the verse it cites.
      </p>
      <ul className="mt-2 divide-y divide-slate-100">
        {list.map((w) => (
          <WordRow
            key={w.id}
            w={w}
            onSaved={(nw) => setList((l) => l.map((x) => (x.id === nw.id ? { ...x, ...nw } : x)))}
            onDeleted={(id) => setList((l) => l.filter((x) => x.id !== id))}
          />
        ))}
      </ul>
    </section>
  );
}

// ─── Study notes ───────────────────────────────────────────────────────────

function Notes({ sermon }) {
  const [text, setText] = useState(null);
  const [original, setOriginal] = useState("");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let live = true;
    setText(null);
    setNotice(null);
    adminFetch(`/api/admin/sermons/${sermon.id}/notes`)
      .then((r) => {
        if (!live) return;
        setText(r.study_notes);
        setOriginal(r.study_notes);
      })
      .catch((e) => live && setNotice({ tone: "error", text: e.message }));
    return () => {
      live = false;
    };
  }, [sermon.id]);

  async function save() {
    setBusy(true);
    setNotice(null);
    try {
      await adminFetch(`/api/admin/sermons/${sermon.id}/notes`, { method: "PUT", body: { study_notes: text } });
      setOriginal(text);
      setNotice({ tone: "success", text: "Notes saved. They show on the lesson page straight away." });
    } catch (e) {
      setNotice({ tone: "error", text: e.message });
    }
    setBusy(false);
  }

  if (text === null) {
    return notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : <div className="h-64 rounded-3xl bg-white/70 motion-safe:animate-pulse" aria-busy="true" />;
  }

  const dirty = text !== original;
  return (
    <section className={cn(card, "space-y-4 p-6")} aria-label="Study notes">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {original ? "Written in Markdown: # for headings, - for bullet points, **bold**." : "This message has no study notes yet. They normally come from the careful pass."}
        </p>
        <div className="flex gap-2">
          <Btn variant="secondary" size="sm" icon={preview ? Pencil : Eye} onClick={() => setPreview((p) => !p)}>
            {preview ? "Edit" : "Preview"}
          </Btn>
          <Btn size="sm" icon={Save} busy={busy} disabled={!dirty} onClick={save}>
            Save notes
          </Btn>
        </div>
      </div>
      <Notice tone={notice?.tone}>{notice?.text}</Notice>
      {preview ? (
        <div className="rounded-2xl bg-slate-50 p-6 text-base leading-[1.8] text-brand-ink/90">
          <div className="max-w-2xl">
            <ReactMarkdown components={NOTES_MARKDOWN}>{text || "_Nothing written yet._"}</ReactMarkdown>
          </div>
        </div>
      ) : (
        <TextArea aria-label="Study notes" rows={20} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-sm" />
      )}
      {dirty && <p className="text-sm font-medium text-[#7a4f00]">You have changes that aren&apos;t saved yet.</p>}
    </section>
  );
}

// ─── History ───────────────────────────────────────────────────────────────

function HistoryEntry({ e }) {
  const [open, setOpen] = useState(false);
  const has = e.before || e.after;
  return (
    <li className="px-5 py-4 sm:px-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <p className="text-brand-ink">{e.summary}</p>
        <time dateTime={e.at} className="flex-shrink-0 text-sm text-slate-500" title={new Date(e.at).toLocaleString("en-GB", { timeZone: "Africa/Lagos" })}>
          {timeAgo(e.at)}
        </time>
      </div>
      {has && (
        <>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-navy hover:underline"
          >
            <ChevronDown size={16} aria-hidden="true" className={cn("transition-transform", open && "rotate-180")} />
            {open ? "Hide what changed" : "What changed"}
          </button>
          {open && (
            <div className="mt-2 grid gap-3 lg:grid-cols-2">
              {["before", "after"].map((k) =>
                e[k] ? (
                  <div key={k}>
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{k === "before" ? "Before" : "After"}</p>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-50 p-3 text-xs text-slate-700">
                      {JSON.stringify(e[k], null, 2)}
                    </pre>
                  </div>
                ) : null
              )}
            </div>
          )}
        </>
      )}
    </li>
  );
}

function HistoryList() {
  const [entries, setEntries] = useState(null);
  const [more, setMore] = useState(false);
  const [setup, setSetup] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (before) => {
    setBusy(true);
    try {
      const r = await adminFetch(`/api/admin/history${before ? `?before=${before}` : ""}`);
      setSetup(!!r.setup);
      setEntries((prev) => (before ? [...(prev || []), ...r.entries] : r.entries));
      setMore(!!r.more);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (setup) return <Notice tone="info">Run admin_stage2.sql in the Supabase SQL editor to start keeping the change history.</Notice>;
  if (!entries) return <div className="h-48 rounded-3xl bg-white/70 motion-safe:animate-pulse" aria-busy="true" />;
  if (!entries.length) {
    return (
      <div className={cn(card, "p-8 text-center")}>
        <History size={20} aria-hidden="true" className="mx-auto text-brand-navy" />
        <p className="mt-2 font-semibold text-brand-ink">No changes yet</p>
        <p className="mt-1 text-sm text-slate-500">Everything you change in the admin area is listed here, with what it was before.</p>
      </div>
    );
  }
  return (
    <section className={card} aria-label="Change history">
      <ul className="divide-y divide-slate-100">
        {entries.map((e) => (
          <HistoryEntry key={e.id} e={e} />
        ))}
      </ul>
      {more && (
        <div className="p-4 text-center">
          <Btn variant="secondary" size="sm" busy={busy} onClick={() => load(entries[entries.length - 1].id)}>
            Show older changes
          </Btn>
        </div>
      )}
    </section>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function Review({ initialTab, initialSermon }) {
  const [tab, setTab] = useState(TABS.some((t) => t.key === initialTab) ? initialTab : "declarations");
  const [sermon, setSermon] = useState(initialSermon || null);

  // Keep the address shareable: /admin/review?tab=notes&sermon=<id>
  useEffect(() => {
    const u = new URL(window.location.href);
    u.searchParams.set("tab", tab);
    if (sermon) u.searchParams.set("sermon", sermon.id);
    else u.searchParams.delete("sermon");
    window.history.replaceState(null, "", u);
  }, [tab, sermon]);

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="What to review" className="flex gap-1 overflow-x-auto rounded-full bg-white p-1 ring-1 ring-brand-navy/[0.07] sm:w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy",
              tab === t.key ? "bg-brand-navy text-white" : "text-slate-600 hover:bg-brand-sky hover:text-brand-navy"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="space-y-6">
        {tab === "history" ? (
          <HistoryList />
        ) : (
          <>
            <SermonPicker sermon={sermon} onPick={setSermon} />
            {sermon && tab === "declarations" && <Declarations sermon={sermon} />}
            {sermon && tab === "words" && <WordStudies sermon={sermon} />}
            {sermon && tab === "notes" && <Notes sermon={sermon} />}
          </>
        )}
      </div>

      {sermon && tab !== "history" && (
        <p className="text-sm text-slate-500">
          Changes go live straight away. Every change is kept under History with what it was before.
        </p>
      )}
    </div>
  );
}
