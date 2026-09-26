import Link from "next/link";
import { BookOpen, FileText, Flame, Languages, Search } from "lucide-react";
import YtThumb from "@/components/YtThumb";
import { StatusBadge } from "@/components/admin/ui";
import { cleanTitle, parseSermonDate } from "@/lib/titles";
import { detectSpeaker } from "@/lib/speakers";
import { TIME_ZONE } from "@/lib/admin-dashboard";
import { cn } from "@/lib/utils";

export const PIECES = [
  { key: "search", label: "Searchable", icon: Search },
  { key: "scriptures", label: "Scriptures", icon: BookOpen },
  { key: "words", label: "Word studies", icon: Languages },
  { key: "declarations", label: "Declarations", icon: Flame },
  { key: "notes", label: "Study notes", icon: FileText },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const partsFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "numeric", year: "numeric", timeZone: TIME_ZONE });

// "2 Sep 2026" (en-GB's own short month is "Sept", which sits oddly next to the rest).
function preachedOn(s) {
  const d = parseSermonDate(s.title) || (s.sermon_date ? new Date(s.sermon_date) : null);
  if (!d || Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]} ${p.year}`;
}

const DATE_SEGMENT = /\b\d{1,2}\s*(st|nd|rd|th)?\s+[a-z]+,?\s+\d{4}\b/i;

/**
 * Admin-only tidy-up. Newer uploads use " - " instead of "|" between the
 * title, the session, the preacher and the date, so cleanTitle() leaves all of
 * it in. Split it back out: preacher and date are already shown on the meta
 * line, the session ("Day 1 Morning, HCM 2026") becomes context.
 */
function splitTitle(raw) {
  const clean = cleanTitle(raw);
  const segs = clean
    .split(/\s+[-–]\s+/)
    .map((x) => x.trim())
    .filter((x) => x && !DATE_SEGMENT.test(x) && !detectSpeaker(x).name);
  if (!segs.length) return { title: clean, context: null };
  let title = segs[0];
  let rest = segs.slice(1);
  while (rest[0]?.startsWith("(")) title = `${title} ${rest.shift()}`; // "Enlarged (A Charge)"
  return { title, context: rest.join(", ") || null };
}

const VIDEO = {
  private: { tone: "critical", text: "Won't play" },
  deleted: { tone: "critical", text: "Won't play" },
  unknown: { tone: "neutral", text: "Check failed" },
  null: { tone: "neutral", text: "Not checked" },
};

/** The legend for the piece icons, shown once in the card header. */
export function PieceLegend() {
  return (
    <ul className="hidden flex-wrap items-center justify-end gap-x-4 gap-y-1 lg:flex" aria-label="Piece icons">
      {PIECES.map(({ key, label, icon: Icon }) => (
        <li key={key} className="flex items-center gap-1.5 text-xs text-slate-500">
          <Icon size={13} aria-hidden="true" className="text-brand-navy" />
          {label}
        </li>
      ))}
    </ul>
  );
}

function Pieces({ pieces }) {
  const have = PIECES.filter((p) => pieces[p.key]).length;
  return (
    <div className="flex items-center gap-3">
      <ul className="flex gap-1.5">
        {PIECES.map(({ key, label, icon: Icon }) => {
          const ok = pieces[key];
          return (
            <li
              key={key}
              title={`${label}: ${ok ? "done" : "missing"}`}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full",
                ok ? "bg-brand-navy text-white" : "border border-dashed border-slate-300 text-slate-400"
              )}
            >
              <Icon size={13} aria-hidden="true" />
              <span className="sr-only">{`${label}: ${ok ? "done" : "missing"}`}</span>
            </li>
          );
        })}
      </ul>
      <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-slate-600">{have} of 5</span>
    </div>
  );
}

export default function RecentSermons({ sermons }) {
  if (!sermons?.length) {
    return <p className="px-6 pb-6 pt-4 text-sm text-slate-500">No sermons yet.</p>;
  }

  return (
    <ul className="mt-4 divide-y divide-slate-100">
      {sermons.map((s) => {
        const speaker = detectSpeaker(s.title).name;
        const date = preachedOn(s);
        const { title, context } = splitTitle(s.title);
        const video = s.video_status === "ok" ? null : VIDEO[s.video_status] || VIDEO.null;
        return (
          <li
            key={s.id}
            className="grid grid-cols-[88px_1fr] gap-x-4 gap-y-3 px-6 py-4 transition-colors hover:bg-brand-sky/40 sm:grid-cols-[128px_1fr] lg:grid-cols-[128px_minmax(0,1fr)_auto] lg:items-center lg:gap-x-6"
          >
            <div className="relative aspect-video overflow-hidden rounded-xl bg-brand-sky">
              <YtThumb ids={s.youtube_video_id} quality="mqdefault" className="h-full w-full object-cover" />
            </div>

            <div className="min-w-0">
              <p className="line-clamp-2 font-semibold leading-snug text-brand-ink" title={cleanTitle(s.title)}>
                <Link href={`/admin/review?sermon=${s.id}`} className="hover:text-brand-navy hover:underline focus-visible:underline focus-visible:outline-none">
                  {title}
                </Link>
                {context && <span className="font-normal text-slate-500"> {context}</span>}
              </p>
              <p className="mt-1 truncate text-sm text-slate-500">
                {[speaker, date].filter(Boolean).join(", ")}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {s.series ? (
                  <span className="max-w-full truncate rounded-full bg-brand-sky px-2.5 py-0.5 text-xs font-medium text-brand-navy">
                    {s.series.title}
                    {s.series.part ? `, part ${s.series.part}` : ""}
                  </span>
                ) : (
                  <span className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                    Not in a series
                  </span>
                )}
                {video && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <StatusBadge tone={video.tone} className="h-4 w-4 [&_svg]:h-2.5 [&_svg]:w-2.5" />
                    {video.text}
                  </span>
                )}
              </div>
            </div>

            <div className="col-span-2 lg:col-span-1">
              <Pieces pieces={s.pieces} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
