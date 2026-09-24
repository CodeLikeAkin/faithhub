import { requireAdminPage } from "@/lib/admin-auth";
import { adminDb } from "@/lib/admin-db";
import { isMissingSetup } from "@/lib/admin-dashboard";
import PageHeader, { PageFrame } from "@/components/admin/PageHeader";
import CarefulPass from "@/components/admin/CarefulPass";
import SetupNeeded from "@/components/admin/SetupNeeded";
import { Notice } from "@/components/admin/controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Careful pass - FaithHub Admin" };

export default async function CarefulPassPage() {
  requireAdminPage();
  const { data, error } = await adminDb().rpc("admin_careful_pass");

  return (
    <PageFrame>
      <PageHeader
        title="Careful pass"
        description="Declarations and study notes are written by Claude to your extraction standard, not by the automatic pipeline. These messages are waiting for that pass."
      />
      {isMissingSetup(error) ? (
        <SetupNeeded file="admin_stage2.sql" />
      ) : error ? (
        <Notice tone="error">Couldn&apos;t load the list. Reload in a minute.</Notice>
      ) : (
        <CarefulPass rows={data || []} />
      )}
    </PageFrame>
  );
}
