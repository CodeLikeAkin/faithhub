import { requireAdminPage } from "@/lib/admin-auth";
import { adminDb } from "@/lib/admin-db";
import { isMissingSetup } from "@/lib/admin-dashboard";
import PageHeader, { PageFrame } from "@/components/admin/PageHeader";
import MessagesBoard from "@/components/admin/MessagesBoard";
import SetupNeeded from "@/components/admin/SetupNeeded";
import { Notice } from "@/components/admin/controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages - FaithHub Admin" };

const param = (v) => (typeof v === "string" ? v.slice(0, 100) : "");

// Only what the list shows, so the page stays light as the library grows.
const slim = (m) => ({
  id: m.id,
  title: m.title || "",
  youtube_video_id: m.youtube_video_id,
  sermon_date: m.sermon_date,
  video_status: m.video_status,
  published: m.published,
  word_studies_none: m.word_studies_none,
  declarations_none: m.declarations_none,
  series_id: m.series_id,
  series_title: m.series_title,
  part_number: m.part_number,
  series_links: m.series_links,
  transcript: m.transcript,
  search: m.search,
  scriptures: m.scriptures,
  word_studies: m.word_studies,
  declarations: m.declarations,
  declarations_kept: m.declarations_kept,
  notes: m.notes,
  job_status: m.job_status,
});

export default async function MessagesPage({ searchParams }) {
  requireAdminPage();
  const { data, error } = await adminDb().rpc("admin_messages");

  return (
    <PageFrame>
      <PageHeader
        title="Messages"
        description="Every message in the library: which study pieces it has, what's missing, and whether visitors can see it. Open one to fix it or publish it."
      />
      {isMissingSetup(error) ? (
        <SetupNeeded file="admin_stage3.sql" />
      ) : error ? (
        <Notice tone="error">Couldn&apos;t load the messages. Reload in a minute.</Notice>
      ) : (
        <MessagesBoard
          messages={(data || []).map(slim)}
          initial={{
            filter: param(searchParams?.filter),
            missing: param(searchParams?.missing),
            q: param(searchParams?.q),
            sort: param(searchParams?.sort),
          }}
        />
      )}
    </PageFrame>
  );
}
