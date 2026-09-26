import { requireAdminPage } from "@/lib/admin-auth";
import { adminDb } from "@/lib/admin-db";
import { isMissingSetup } from "@/lib/admin-dashboard";
import { loadProposals } from "@/lib/admin-series-db";
import PageHeader, { PageFrame } from "@/components/admin/PageHeader";
import SeriesBoard from "@/components/admin/SeriesBoard";
import SetupNeeded from "@/components/admin/SetupNeeded";
import { Notice } from "@/components/admin/controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Series - FaithHub Admin" };

export default async function SeriesPage() {
  requireAdminPage();
  const [overview, proposals] = await Promise.all([
    adminDb().rpc("admin_series_overview"),
    loadProposals().catch(() => null),
  ]);

  return (
    <PageFrame>
      <PageHeader
        title="Series"
        description="Every series in the public catalog. Open one to rename it, fix part numbers, add or remove messages, or have its summary rewritten."
      />
      {isMissingSetup(overview.error) ? (
        <SetupNeeded file="admin_stage2.sql" />
      ) : overview.error ? (
        <Notice tone="error">Couldn&apos;t load the series. Reload in a minute.</Notice>
      ) : (
        <SeriesBoard series={overview.data || []} proposals={proposals} />
      )}
    </PageFrame>
  );
}
