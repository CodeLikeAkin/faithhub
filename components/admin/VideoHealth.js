import { StatusBadge, fmt } from "@/components/admin/ui";
import CheckVideosButton from "@/components/admin/CheckVideosButton";
import { cn } from "@/lib/utils";

/*
 * Part-to-whole for every video in the library: plays / won't play / not
 * checked. Status meaning, so status colours (never categorical), each with a
 * legend row carrying badge + label + count. 2px surface gap between
 * segments; tiny segments get a minimum width so they stay findable.
 */

export default function VideoHealth({ coverage, unknownVideos = 0 }) {
  const total = coverage.sermons_total;
  const dead = coverage.dead_videos_total;
  const unchecked = coverage.videos_unchecked + unknownVideos;
  const plays = Math.max(0, total - dead - unchecked);

  const parts = [
    { key: "plays", label: "Plays", count: plays, tone: "good", fill: "bg-[#0ca30c]" },
    { key: "dead", label: "Won't play (private or deleted)", count: dead, tone: "critical", fill: "bg-[#d03b3b]" },
    { key: "unchecked", label: "Not checked yet", count: unchecked, tone: "neutral", fill: "bg-slate-400" },
  ].filter((p) => p.count > 0);

  return (
    <div className="px-6 pb-6 pt-5">
      <div className="flex h-3 w-full gap-0.5" aria-hidden="true">
        {parts.map((p, i) => (
          <div
            key={p.key}
            tabIndex={0}
            className="group relative min-w-[8px] outline-none"
            style={{ flexGrow: p.count, flexBasis: 0 }}
          >
            <div
              className={cn(
                "h-full origin-left motion-safe:animate-grow-x group-hover:brightness-110 group-focus-visible:ring-2 group-focus-visible:ring-brand-navy group-focus-visible:ring-offset-2",
                p.fill,
                i === 0 && "rounded-l",
                i === parts.length - 1 && "rounded-r"
              )}
              style={{ animationDelay: `${200 + i * 120}ms` }}
            />
            <span
              role="tooltip"
              className={cn(
                "pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap rounded-xl bg-brand-ink px-3 py-2 shadow-lg group-hover:block group-focus-visible:block",
                i === parts.length - 1 && parts.length > 1 ? "right-0" : "left-0"
              )}
            >
              <span className="block text-sm font-bold text-white">
                {fmt(p.count)} {p.count === 1 ? "video" : "videos"}
              </span>
              <span className="block text-xs text-brand-mist">{p.label}</span>
            </span>
          </div>
        ))}
      </div>

      <ul className="mt-6 space-y-3">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-3">
            <StatusBadge tone={p.tone} />
            <span className="flex-1 text-sm text-slate-700">{p.label}</span>
            <span className="text-sm font-bold tabular-nums text-brand-ink">{fmt(p.count)}</span>
          </li>
        ))}
      </ul>

      {coverage.dead_videos_in_catalog > 0 && (
        <p className="mt-5 rounded-2xl bg-[#d03b3b]/[0.07] px-4 py-3 text-sm text-brand-ink">
          <span className="font-bold">{fmt(coverage.dead_videos_in_catalog)}</span> of the videos that won&apos;t
          play are in the public catalog, so visitors can see them. The Series page shows which series they&apos;re in.
        </p>
      )}

      {unchecked > 0 && (
        <div className="mt-5">
          <CheckVideosButton />
        </div>
      )}
    </div>
  );
}
