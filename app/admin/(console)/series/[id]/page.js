import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin-auth";
import { adminDb } from "@/lib/admin-db";
import { UUID_RE } from "@/lib/admin-api";
import PageHeader, { PageFrame } from "@/components/admin/PageHeader";
import SeriesEditor from "@/components/admin/SeriesEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Series - FaithHub Admin" };

export default async function SeriesDetailPage({ params }) {
  requireAdminPage();
  if (!UUID_RE.test(params.id)) notFound();

  const db = adminDb();
  const [{ data: series }, { data: links }] = await Promise.all([
    db.from("series").select("id, title, study_summary, start_date, end_date").eq("id", params.id).maybeSingle(),
    db
      .from("series_sermons")
      .select("part_number, sermons ( id, title, youtube_video_id, sermon_date, video_status )")
      .eq("series_id", params.id),
  ]);
  if (!series) notFound();

  const parts = (links || [])
    .filter((l) => l.sermons)
    .map((l) => ({
      sermon_id: l.sermons.id,
      title: l.sermons.title,
      youtube_video_id: l.sermons.youtube_video_id,
      sermon_date: l.sermons.sermon_date,
      video_status: l.sermons.video_status,
      part_number: l.part_number,
    }));

  // Which study pieces each part has (needs admin_stage2.sql; the page works without it).
  let pieces = null;
  if (parts.length) {
    const { data, error } = await db.rpc("admin_sermon_pieces", { p_ids: parts.map((p) => p.sermon_id) });
    if (!error) pieces = Object.fromEntries((data || []).map((r) => [r.sermon_id, r]));
  }

  return (
    <PageFrame>
      <Link href="/admin/series" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-navy hover:underline">
        <ChevronLeft size={16} aria-hidden="true" /> All series
      </Link>
      <PageHeader title={series.title} description={`${parts.length} ${parts.length === 1 ? "message" : "messages"} in this series.`} />
      <SeriesEditor series={series} parts={parts} pieces={pieces} />
    </PageFrame>
  );
}
