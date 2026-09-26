import Link from "next/link";
import { AlertTriangle, BookMarked, CheckCircle2, ChevronRight, Flame, Library, Layers } from "lucide-react";
import { requireAdminPage } from "@/lib/admin-auth";
import { TIME_ZONE, loadDashboard } from "@/lib/admin-dashboard";
import { Card, StatTile, StatusBadge, fmt, rise } from "@/components/admin/ui";
import { DotGrid } from "@/components/Decor";
import ReadinessCard from "@/components/admin/ReadinessCard";
import MonthlyChart from "@/components/admin/MonthlyChart";
import VideoHealth from "@/components/admin/VideoHealth";
import RecentSermons, { PieceLegend } from "@/components/admin/RecentSermons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview - FaithHub Admin" };

const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : many}`;

function greeting(now) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: TIME_ZONE }).format(now));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function ago(minutes) {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const h = Math.round(minutes / 60);
  return h < 48 ? `${h} hr ago` : `${Math.round(h / 24)} days ago`;
}

function systemRows(d) {
  const w = d.worker;
  const worker = {
    setup: { tone: "warning", state: "Not set up yet" },
    error: { tone: "neutral", state: "Couldn't check" },
    never: { tone: "warning", state: "Has not connected yet" },
    offline: { tone: "warning", state: `Offline, last seen ${ago(w.minutes)}` },
    online: { tone: "good", state: `Connected, ${ago(w.minutes)}` },
  }[w.state];

  const c = d.coverage;
  const queued = c ? c.jobs_queued : 0;
  const running = c ? c.jobs_running : 0;

  return [
    { label: "Database", ...(d.coverageError ? { tone: "critical", state: "Couldn't reach it" } : { tone: "good", state: "Connected" }) },
    { label: "Processing computer", ...worker },
    { label: "YouTube access", ...(d.youtubeKey ? { tone: "good", state: "Key is set" } : { tone: "critical", state: "Key is missing" }) },
    {
      label: "Processing queue",
      tone: "good",
      state: queued + running === 0 ? "Nothing waiting" : `${running} running, ${queued} waiting`,
    },
  ];
}

function attentionItems(d) {
  const c = d.coverage;
  const items = [];
  if (c.dead_videos_in_catalog > 0)
    items.push({ tone: "critical", n: c.dead_videos_in_catalog, text: "catalog messages have a video that won't play", href: "/admin/series" });
  if (d.worker.state !== "online")
    items.push({ tone: "warning", text: "The processing computer isn't connected, so new links can't be processed yet", href: "/admin/processing" });
  if (c.catalog_no_declarations > 0)
    items.push({ tone: "warning", n: c.catalog_no_declarations, text: "catalog messages are waiting for declarations", href: "/admin/careful-pass" });
  if (c.catalog_no_notes > 0)
    items.push({ tone: "warning", n: c.catalog_no_notes, text: "catalog messages are waiting for study notes", href: "/admin/careful-pass" });
  if (c.catalog_no_scriptures > 0)
    items.push({ tone: "warning", n: c.catalog_no_scriptures, text: "catalog messages have no scripture list" });
  if (c.videos_unchecked + d.unknownVideos > 0)
    items.push({ tone: "neutral", n: c.videos_unchecked + d.unknownVideos, text: "videos haven't been checked to see if they play", href: "#video-health" });
  return items;
}

function Header({ d, attention }) {
  const date = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: TIME_ZONE }).format(d.now);
  const r = rise(0);
  return (
    <div style={r.style} className={`${r.className} relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between`}>
      <DotGrid className="-right-6 -top-10 hidden h-40 w-72 [mask-image:radial-gradient(closest-side,black,transparent)] md:block" />
      <div className="relative">
        <p className="text-sm font-medium text-slate-500">{date}</p>
        <h1 className="mt-1 font-display text-4xl font-medium tracking-tight text-brand-ink sm:text-5xl">{greeting(d.now)}</h1>
        <p className="mt-2 max-w-[60ch] text-slate-600">Here is how FaithHub is doing today.</p>
      </div>
      {attention !== null &&
        (attention > 0 ? (
          <a
            href="#attention"
            className="relative inline-flex items-center gap-2 self-start rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-ink shadow-sm ring-1 ring-brand-navy/10 transition-colors hover:bg-brand-sky sm:self-auto"
          >
            <AlertTriangle size={16} aria-hidden="true" className="text-[#b7791f]" />
            {plural(attention, "thing needs", "things need")} attention
          </a>
        ) : (
          <span className="relative inline-flex items-center gap-2 self-start rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-ink shadow-sm ring-1 ring-brand-navy/10 sm:self-auto">
            <CheckCircle2 size={16} aria-hidden="true" className="text-[#0ca30c]" />
            All clear
          </span>
        ))}
    </div>
  );
}

/** One slim row: can FaithHub take in new messages right now? */
function SystemStrip({ d }) {
  const r = rise(1);
  return (
    <section
      aria-label="System status"
      style={r.style}
      className={`${r.className} grid grid-cols-1 overflow-hidden rounded-3xl border border-brand-navy/[0.07] bg-white shadow-[0_1px_2px_rgba(16,42,78,0.04)] sm:grid-cols-2 xl:grid-cols-4`}
    >
      {systemRows(d).map((row, i) => (
        <div
          key={row.label}
          className={`flex items-center gap-3 px-5 py-4 ${i > 0 ? "border-t border-slate-100" : ""} ${i === 1 ? "sm:border-t-0 sm:border-l" : ""} ${i === 2 ? "xl:border-t-0 xl:border-l" : ""} ${i === 3 ? "sm:border-l xl:border-t-0" : ""}`}
        >
          <StatusBadge tone={row.tone} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-ink">{row.label}</p>
            <p className="truncate text-sm text-slate-500">{row.state}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

function SetupNotice() {
  return (
    <Card order={1} title="One-time database setup needed" className="p-0">
      <p className="px-6 pb-6 pt-2 text-slate-600">
        Run admin_stage1.sql in the Supabase SQL editor, then reload this page. Nothing existing is changed by it.
      </p>
    </Card>
  );
}

function ErrorNotice() {
  return (
    <Card order={1} title="Couldn't load the numbers">
      <p className="px-6 pb-6 pt-2 text-slate-600">
        The database didn&apos;t answer. Reload in a minute. If it keeps happening, check whether the Supabase project is paused.
      </p>
    </Card>
  );
}

export default async function AdminOverview() {
  requireAdminPage();
  const d = await loadDashboard();
  const c = d.coverage;
  const attention = c ? attentionItems(d) : null;
  const catalogShare = c && c.sermons_total ? Math.round((c.catalog_sermons / c.sermons_total) * 100) : null;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-8 sm:px-8 sm:py-10">
      <Header d={d} attention={attention ? attention.length : null} />

      {d.needsSetup && <SetupNotice />}
      {d.coverageError && <ErrorNotice />}

      <SystemStrip d={d} />

      {c && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatTile
              order={2}
              icon={Library}
              label="Messages in the library"
              value={fmt(c.sermons_total)}
              note={d.library ? `${plural(d.library.addedThisWeek, "added", "added")} in the last 7 days` : null}
            />
            <StatTile
              order={3}
              icon={BookMarked}
              label="In the public catalog"
              value={fmt(c.catalog_sermons)}
              note={catalogShare !== null ? `${catalogShare}% of the library` : null}
            />
            <StatTile
              order={4}
              icon={Layers}
              label="Series"
              value={fmt(c.series_total)}
              note={c.series_total ? `About ${Math.round(c.catalog_sermons / c.series_total)} messages each` : null}
            />
            <StatTile
              order={5}
              icon={Flame}
              label="Declarations"
              value={fmt(d.declarationsTotal)}
              note="Live in the Declarations library"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <ReadinessCard order={6} coverage={c} segmentGaps={d.segmentGaps} className="xl:col-span-2" />

            <Card id="attention" order={7} title="Needs attention" subtitle="Things to fix, most urgent first.">
              {attention.length ? (
                <ul className="space-y-1 px-3 pb-4 pt-3">
                  {attention.map((a, i) => {
                    const body = (
                      <>
                        <StatusBadge tone={a.tone} className="mt-0.5" />
                        <p className="flex-1 text-sm leading-relaxed text-slate-700">
                          {typeof a.n === "number" && <span className="font-bold text-brand-ink">{fmt(a.n)} </span>}
                          {a.text}
                        </p>
                        {a.href && <ChevronRight size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />}
                      </>
                    );
                    return (
                      <li key={i}>
                        {a.href ? (
                          <Link
                            href={a.href}
                            className="group flex items-start gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-brand-sky/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
                          >
                            {body}
                          </Link>
                        ) : (
                          <div className="flex items-start gap-3 rounded-2xl px-3 py-2.5">{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="flex items-center gap-3 px-6 pb-6 pt-4">
                  <StatusBadge tone="good" />
                  <p className="text-sm text-slate-700">Nothing needs attention.</p>
                </div>
              )}
            </Card>

            <Card
              order={8}
              title="Messages per month"
              subtitle="New messages in the library, by YouTube upload date."
              className="xl:col-span-2"
            >
              {d.library ? (
                <MonthlyChart months={d.library.months} />
              ) : (
                <p className="px-6 pb-6 pt-4 text-sm text-slate-500">Couldn&apos;t load this just now.</p>
              )}
            </Card>

            <Card id="video-health" order={9} title="Video health" subtitle={`All ${fmt(c.sermons_total)} videos in the library.`}>
              <VideoHealth coverage={c} unknownVideos={d.unknownVideos} />
            </Card>

            <Card
              order={10}
              title="Recently added"
              subtitle="The newest messages and which study pieces they have."
              action={<PieceLegend />}
              className="xl:col-span-3"
            >
              {d.recentError ? (
                <p className="px-6 pb-6 pt-4 text-sm text-slate-500">Couldn&apos;t load this just now.</p>
              ) : (
                <RecentSermons sermons={d.recent} />
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
