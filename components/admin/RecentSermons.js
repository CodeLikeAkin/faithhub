import Link from "next/link";
import { BookOpen, FileText, Flame, Languages, Search } from "lucide-react";
import YtThumb from "@/components/YtThumb";
import { StatusBadge } from "@/components/admin/ui";
import { cleanTitle } from "@/lib/titles";
import { preachedOn, speakerOf, splitTitle } from "@/lib/admin-titles";
import { cn } from "@/lib/utils";

export const PIECES = [
  { key: "search", label: "Searchable", icon: Search },
  { key: "scriptures", label: "Scriptures", icon: BookOpen },
  { key: "words", label: "Word studies", icon: Languages },
  { key: "declarations", label: "Declarations", icon: Flame },
  { key: "notes", label: "Study notes", icon: FileText },
];

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
        const speaker = speakerOf(s.title);
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
                <Link href={`/admin/messages/${s.id}`} className="hover:text-brand-navy hover:underline focus-visible:underline focus-visible:outline-none">
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
                {s.published === false && (
                  <span className="rounded-full bg-[#fab219]/20 px-2.5 py-0.5 text-xs font-semibold text-[#7a4f00]">
                    Waiting to publish
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
