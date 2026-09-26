import { requireAdminPage } from "@/lib/admin-auth";
import { adminDb } from "@/lib/admin-db";
import { UUID_RE } from "@/lib/admin-api";
import PageHeader, { PageFrame } from "@/components/admin/PageHeader";
import Review from "@/components/admin/Review";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review - FaithHub Admin" };

export default async function ReviewPage({ searchParams }) {
  requireAdminPage();

  // Opened with ?sermon=<id> (e.g. from the Overview): start on that message.
  let initialSermon = null;
  const id = typeof searchParams?.sermon === "string" ? searchParams.sermon : "";
  if (UUID_RE.test(id)) {
    const { data } = await adminDb()
      .from("sermons")
      .select("id, title, youtube_video_id, sermon_date, series_sermons ( part_number, series ( id, title ) )")
      .eq("id", id)
      .maybeSingle();
    if (data) {
      const link = data.series_sermons?.[0];
      initialSermon = {
        id: data.id,
        title: data.title,
        youtube_video_id: data.youtube_video_id,
        sermon_date: data.sermon_date,
        series: link ? { id: link.series?.id, title: link.series?.title, part_number: link.part_number } : null,
      };
    }
  }

  return (
    <PageFrame>
      <PageHeader
        title="Review"
        description="Fix a declaration's wording or themes, remove a word study that isn't really in the message, edit study notes, and see every change made here."
      />
      <Review initialTab={typeof searchParams?.tab === "string" ? searchParams.tab : "declarations"} initialSermon={initialSermon} />
    </PageFrame>
  );
}
