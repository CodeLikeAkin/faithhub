"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Captions,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Flame,
  Languages,
  Pencil,
  PlayCircle,
  RotateCw,
  Search,
} from "lucide-react";
import YtThumb from "@/components/YtThumb";
import { Rings } from "@/components/Decor";
import { StatusBadge } from "@/components/admin/ui";
import { Btn, Chip, ConfirmBtn, Field, Input, Notice } from "@/components/admin/controls";
import { adminFetch } from "@/lib/admin-client";
import { fmtDate, timeAgo } from "@/lib/admin-format";
import { isDeadVideo, preachedOn, speakerOf, splitTitle } from "@/lib/admin-titles";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("en-GB");
const card = "rounded-3xl border border-brand-navy/[0.07] bg-white shadow-[0_1px_2px_rgba(16,42,78,0.04),0_12px_32px_-18px_rgba(16,42,78,0.18)]";
const plural = (n, one, many) => `${nf.format(n)} ${n === 1 ? one : many}`;

const VIDEO = {
  ok: { tone: "good", text: "Video plays" },
  private: { tone: "critical", text: "Video is private, so it won't play" },
  deleted: { tone: "critical", text: "Video was deleted, so it won't play" },
  unknown: { tone: "neutral", text: "Video check failed" },
};

const JOB = {
  queued: { tone: "warn", text: "Waiting" },
  running: { tone: "warn", text: "Processing" },
  done: { tone: "good", text: "Finished" },
  failed: { tone: "bad", text: "Failed" },
  cancelled: { tone: "outline", text: "Cancelled" },
};

const reviewHref = (tab, id) => `/admin/review?tab=${tab}&sermon=${id}`;

// ─── Title ─────────────────────────────────────────────────────────────────

function TitleEditor({ m, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { title, context } = splitTitle(m.title);

  async function save() {
    setBusy(true);
    setError("");
    try {
      const r = await adminFetch(`/api/admin/sermons/${m.id}`, { method: "PATCH", body: { title: text } });
      onSaved(r.sermon);
      setEditing(false);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  if (editing) {
    return (
      <div className="space-y-3">
        <Field
          id="msg-title"
          label="Title"
          error={error}
          hint="Changes the name on FaithHub only; YouTube keeps its own. Keep the series name in it, so new parts still match."
        >
          <Input id="msg-title" maxLength={300} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </Field>
        <div className="flex gap-2">
          <Btn size="sm" icon={Check} busy={busy} disabled={text.trim().length < 4} onClick={save}>
            Save title
          </Btn>
          <Btn variant="ghost" size="sm" onClick={() => { setEditing(false); setText(m.title); setError(""); }}>
            Cancel
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-medium leading-tight tracking-tight text-brand-ink sm:text-4xl">{title}</h1>
      {context && <p className="mt-1 text-lg text-slate-500">{context}</p>}
      <p className="mt-2 break-words text-xs text-slate-400" title="The full stored title">
        {m.title}
      </p>
      <Btn variant="ghost" size="sm" icon={Pencil} className="-ml-3 mt-1" onClick={() => setEditing(true)}>
        Edit title
      </Btn>
    </div>
  );
}

// ─── Publish ───────────────────────────────────────────────────────────────

function PublishCard({ m, missing, onChange }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  async function set(published) {
    setBusy(true);
    setNotice(null);
    try {
      const r = await adminFetch(`/api/admin/sermons/${m.id}`, { method: "PATCH", body: { published } });
      onChange(r.sermon);
      const cleared = r.summaries_cleared?.length
        ? ` The summary of ${r.summaries_cleared.map((t) => `"${t}"`).join(", ")} will be rewritten the next time someone opens it.`
        : "";
      setNotice({ tone: "success", text: (published ? "Published. Visitors can find it now." : "Hidden from the browse pages.") + cleared });
    } catch (e) {
      setNotice({ tone: "error", text: e.message });
    }
    setBusy(false);
  }

  if (!m.published) {
    return (
      <section aria-labelledby="publish-title" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-navy via-brand-deep to-[#0B1F3B] p-6 text-white shadow-[0_24px_48px_-24px_rgba(16,42,78,0.55)]">
        <Rings className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 text-white/[0.06]" />
        <div className="relative space-y-4">
          <p className="inline-flex items-center gap-2 rounded-full bg-[#fab219]/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#fcd57a]">
            Waiting to publish
          </p>
          <h2 id="publish-title" className="text-xl font-bold">Not on the browse pages yet</h2>
          <p className="text-sm leading-relaxed text-brand-mist">
            Visitors won&apos;t see it on the home page or in {m.series.length ? "its series" : "the series pages"} until you
            publish it. It can already turn up in Ask the Word, Declarations and The Word.
          </p>
          <p className="text-sm text-white">
            {missing.length ? (
              <>
                Still missing: <span className="font-semibold">{missing.join(", ")}</span>. You can publish now and add
                them later.
              </>
            ) : (
              <span className="font-semibold">Every study piece is in place.</span>
            )}
          </p>
          <ConfirmBtn
            variant="primary"
            size="md"
            onDark
            icon={Eye}
            className="w-full bg-white text-brand-navy shadow-none hover:bg-brand-sky focus-visible:ring-white sm:w-auto"
            question="Publish it on the live site?"
            confirmLabel="Publish"
            busy={busy}
            onConfirm={() => set(true)}
          >
            Publish
          </ConfirmBtn>
          {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="publish-title" className={cn(card, "space-y-4 p-6")}>
      <div className="flex items-center gap-3">
        <StatusBadge tone="good" />
        <h2 id="publish-title" className="text-lg font-bold text-brand-ink">Live on the site</h2>
      </div>
      <p className="text-sm leading-relaxed text-slate-600">
        {m.series.length
          ? "Visitors can browse it in its series and on the home page."
          : "Published, but it isn't in a series, so visitors mostly reach it through Ask the Word and search."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/sermon/${m.id}`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
        >
          <ExternalLink size={16} aria-hidden="true" />
          Open on the live site
        </a>
        <ConfirmBtn icon={EyeOff} question="Hide it from the browse pages?" confirmLabel="Hide" busy={busy} onConfirm={() => set(false)}>
          Hide
        </ConfirmBtn>
      </div>
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
    </section>
  );
}

// ─── Study pieces ──────────────────────────────────────────────────────────

function ActionLink({ href, children }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
    >
      {children}
      <ArrowRight size={14} aria-hidden="true" />
    </Link>
  );
}

function WordStudiesNone({ m, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function set(value) {
    setBusy(true);
    setError("");
    try {
      const r = await adminFetch(`/api/admin/sermons/${m.id}`, { method: "PATCH", body: { word_studies_none: value } });
      onChange(r.sermon);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      {m.word_studies_none ? (
        <Btn variant="ghost" size="sm" busy={busy} onClick={() => set(false)}>
          Undo
        </Btn>
      ) : (
        <Btn variant="secondary" size="sm" icon={Check} busy={busy} onClick={() => set(true)}>
          None needed
        </Btn>
      )}
      {error && <p className="text-xs font-medium text-[#b42318]">{error}</p>}
    </div>
  );
}

function Pieces({ m, onChange, onProcess, processing }) {
  const c = m.counts;
  const inSeries = m.series.length > 0;
  const rows = [
    {
      key: "transcript",
      icon: Captions,
      label: "Transcript",
      state: m.transcript ? "have" : "missing",
      detail: m.transcript ? "In place" : "Missing. Nothing else can be made without it.",
    },
    {
      key: "search",
      icon: Search,
      label: "Searchable in Ask the Word",
      state: c.segments ? "have" : "missing",
      detail: c.segments ? plural(c.segments, "passage", "passages") : "Not searchable yet",
    },
    {
      key: "scriptures",
      icon: BookOpen,
      label: "Scripture list",
      state: c.scriptures ? "have" : "missing",
      detail: c.scriptures ? plural(c.scriptures, "verse", "verses") : "No verses found yet",
    },
    {
      key: "declarations",
      icon: Flame,
      label: "Declarations",
      state: c.declarations ? "have" : "missing",
      detail: c.declarations ? plural(c.declarations, "declaration", "declarations") : "Waiting for the careful pass",
      action: c.declarations ? (
        <ActionLink href={reviewHref("declarations", m.id)}>Review</ActionLink>
      ) : (
        <ActionLink href="/admin/careful-pass">Careful pass</ActionLink>
      ),
    },
    {
      key: "notes",
      icon: FileText,
      label: "Study notes",
      state: m.notes ? "have" : inSeries ? "missing" : "na",
      detail: m.notes ? "Written" : inSeries ? "Waiting for the careful pass" : "Only written for messages in a series",
      action: m.notes ? (
        <ActionLink href={reviewHref("notes", m.id)}>Review</ActionLink>
      ) : inSeries ? (
        <ActionLink href="/admin/careful-pass">Careful pass</ActionLink>
      ) : null,
    },
    {
      key: "words",
      icon: Languages,
      label: "Word studies",
      state: c.words ? "have" : m.word_studies_none ? "na" : "missing",
      detail: c.words
        ? plural(c.words, "word", "words")
        : m.word_studies_none
        ? "Checked: this message explains no Greek or Hebrew word"
        : "None yet. If it explains no Greek or Hebrew word, mark it.",
      action: c.words ? <ActionLink href={reviewHref("words", m.id)}>Review</ActionLink> : <WordStudiesNone m={m} onChange={onChange} />,
    },
  ];
  const automatic = ["transcript", "search", "scriptures"].some((k) => rows.find((r) => r.key === k).state === "missing");

  return (
    <section aria-labelledby="pieces-title" className={card}>
      <header className="flex flex-col gap-3 px-6 pt-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="pieces-title" className="text-lg font-bold text-brand-ink">Study pieces</h2>
          <p className="mt-1 text-sm text-slate-500">What this message has, and where to fix what it doesn&apos;t.</p>
        </div>
        <Btn
          variant={automatic ? "primary" : "secondary"}
          size="sm"
          icon={RotateCw}
          busy={processing.busy}
          disabled={processing.blocked}
          onClick={onProcess}
          title="Fills in whatever is missing: transcript, search, scripture list and word studies. Nothing that exists is replaced."
        >
          {processing.blocked ? "In the processing queue" : "Process again"}
        </Btn>
      </header>
      {processing.notice && (
        <div className="px-6 pt-3">
          <Notice tone={processing.notice.tone}>{processing.notice.text}</Notice>
        </div>
      )}
      <ul className="mt-3 divide-y divide-slate-100">
        {rows.map(({ key, icon: Icon, label, state, detail, action }) => (
          <li key={key} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <span
                className={cn(
                  "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl",
                  state === "have" && "bg-brand-navy text-white",
                  state === "na" && "bg-brand-sky text-brand-navy/60",
                  state === "missing" && "border-2 border-dashed border-slate-300 text-slate-400"
                )}
              >
                <Icon size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-brand-ink">{label}</p>
                <p className={cn("text-sm", state === "missing" ? "text-[#7a4f00]" : "text-slate-500")}>{detail}</p>
              </div>
            </div>
            {action && <div className="flex-shrink-0 pl-14 sm:pl-0">{action}</div>}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function MessageDetail({ message }) {
  const router = useRouter();
  const [m, setM] = useState(message);
  const [processing, setProcessing] = useState({ busy: false, notice: null });
  useEffect(() => setM(message), [message]);

  // Saved changes come back as the plain sermon row; the page's extras stay.
  const merge = (row) => {
    if (row) setM((cur) => ({ ...cur, ...row }));
    router.refresh();
  };

  const latestJob = m.jobs[0];
  const blocked = latestJob && (latestJob.status === "queued" || latestJob.status === "running");
  const inSeries = m.series.length > 0;
  const missing = [
    !m.transcript && "transcript",
    !m.counts.segments && "search",
    !m.counts.scriptures && "scripture list",
    !m.counts.declarations && "declarations",
    inSeries && !m.notes && "study notes",
    !m.counts.words && !m.word_studies_none && "word studies",
  ].filter(Boolean);

  async function processAgain() {
    setProcessing({ busy: true, notice: null });
    try {
      const { results } = await adminFetch("/api/admin/jobs", {
        method: "POST",
        body: { items: [{ youtube_video_id: m.youtube_video_id, title: m.title, series_id: null, part_number: null }] },
      });
      const r = results[0];
      setProcessing({
        busy: false,
        notice: r?.ok
          ? { tone: "success", text: "Queued. The processing computer picks it up at its next check, within half an hour." }
          : { tone: "error", text: r?.error || "Couldn't queue it." },
      });
      router.refresh();
    } catch (e) {
      setProcessing({ busy: false, notice: { tone: "error", text: e.message } });
    }
  }

  const speaker = speakerOf(m.title);
  const preached = preachedOn(m);
  const video = VIDEO[m.video_status] || { tone: "neutral", text: "Video not checked yet" };

  return (
    <div className="space-y-6">
      <Link
        href="/admin/messages"
        className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold text-brand-navy transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        All messages
      </Link>

      <section className={cn(card, "grid grid-cols-1 gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]")}>
        <a
          href={`https://www.youtube.com/watch?v=${m.youtube_video_id}`}
          target="_blank"
          rel="noopener"
          className="group relative block aspect-video overflow-hidden rounded-2xl bg-brand-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
          aria-label="Watch on YouTube"
        >
          <YtThumb ids={m.youtube_video_id} quality={["maxresdefault", "hq720", "mqdefault"]} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          <span className="absolute inset-0 flex items-center justify-center bg-brand-ink/0 transition-colors group-hover:bg-brand-ink/25">
            <PlayCircle size={44} aria-hidden="true" className="text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100" />
          </span>
        </a>
        <div className="min-w-0 space-y-4">
          <TitleEditor m={m} onSaved={merge} />
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {speaker && (
              <div>
                <dt className="text-slate-500">Preacher</dt>
                <dd className="font-medium text-brand-ink">{speaker}</dd>
              </div>
            )}
            {preached && (
              <div>
                <dt className="text-slate-500">Preached</dt>
                <dd className="font-medium text-brand-ink">{preached}</dd>
              </div>
            )}
            <div>
              <dt className="text-slate-500">Uploaded to YouTube</dt>
              <dd className="font-medium text-brand-ink">{fmtDate(m.sermon_date) || "Not known"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Added to FaithHub</dt>
              <dd className="font-medium text-brand-ink">{fmtDate(m.created_at) || "Not known"}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            {m.published ? <Chip tone="good">Published</Chip> : <Chip tone="warn">Waiting to publish</Chip>}
            <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
              <StatusBadge tone={video.tone} className="h-4 w-4 [&_svg]:h-2.5 [&_svg]:w-2.5" />
              {video.text}
            </span>
            <a
              href={`https://www.youtube.com/watch?v=${m.youtube_video_id}`}
              target="_blank"
              rel="noopener"
              className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-brand-navy hover:underline"
            >
              YouTube
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
          {isDeadVideo(m.video_status) && (
            <Notice tone="error">
              Visitors can&apos;t watch this video. If the church re-uploaded it, add the new link from Add sermons and hide this
              one.
            </Notice>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Pieces m={m} onChange={merge} onProcess={processAgain} processing={{ ...processing, blocked }} />
        </div>

        <div className="space-y-6">
          <PublishCard m={m} missing={missing} onChange={merge} />

          <section aria-labelledby="series-title" className={cn(card, "p-6")}>
            <h2 id="series-title" className="text-lg font-bold text-brand-ink">Series</h2>
            {inSeries ? (
              <ul className="mt-3 space-y-2">
                {m.series.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/admin/series/${s.id}`}
                      className="group flex items-center justify-between gap-3 rounded-2xl bg-brand-sky/60 px-4 py-3 transition-colors hover:bg-brand-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-brand-ink">{s.title}</span>
                        <span className="text-sm text-slate-600">Part {s.part}</span>
                      </span>
                      <ArrowRight size={16} aria-hidden="true" className="flex-shrink-0 text-brand-navy transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Not in a series, so it stays out of the public catalog. To add it to one, open that series and use
                  &ldquo;Add a message to this series&rdquo; at the bottom.
                </p>
                <div className="mt-3">
                  <ActionLink href="/admin/series">Go to Series</ActionLink>
                </div>
              </>
            )}
          </section>

          <section aria-labelledby="activity-title" className={cn(card, "p-6")}>
            <h2 id="activity-title" className="text-lg font-bold text-brand-ink">Activity</h2>
            {!m.jobs.length && !m.history.length && <p className="mt-2 text-sm text-slate-500">No processing runs or edits from the admin page yet.</p>}
            {m.jobs.length > 0 && (
              <>
                <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">Processing</h3>
                <ul className="mt-2 space-y-2">
                  {m.jobs.map((j) => {
                    const s = JOB[j.status] || JOB.cancelled;
                    return (
                      <li key={j.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <Chip tone={s.tone}>{s.text}</Chip>
                        <span className="text-slate-500">{timeAgo(j.finished_at || j.created_at)}</span>
                        {j.error && <span className="w-full text-xs text-[#912018]">{j.error}</span>}
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-2">
                  <ActionLink href="/admin/processing">Processing page</ActionLink>
                </div>
              </>
            )}
            {m.history.length > 0 && (
              <>
                <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">Changes made here</h3>
                <ul className="mt-2 space-y-2">
                  {m.history.map((h) => (
                    <li key={h.id} className="text-sm">
                      <p className="text-brand-ink">{h.summary}</p>
                      <p className="text-xs text-slate-500">{timeAgo(h.at)}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
