import { requireAdminPage } from "@/lib/admin-auth";
import { loadWorker } from "@/lib/admin-dashboard";
import PageHeader, { PageFrame } from "@/components/admin/PageHeader";
import AddSermons from "@/components/admin/AddSermons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add sermons - FaithHub Admin" };

export default async function AddSermonsPage() {
  requireAdminPage();
  const worker = await loadWorker();

  return (
    <PageFrame>
      <PageHeader
        title="Add sermons"
        description="Paste links to new messages, or pick them from the new uploads list. Check the series for each, then add them to the queue. Your processing computer does the rest."
      />
      <AddSermons workerOnline={worker.state === "online"} />
    </PageFrame>
  );
}
