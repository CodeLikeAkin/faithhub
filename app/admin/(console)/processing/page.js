import { requireAdminPage } from "@/lib/admin-auth";
import PageHeader, { PageFrame } from "@/components/admin/PageHeader";
import ProcessingBoard from "@/components/admin/ProcessingBoard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Processing - FaithHub Admin" };

export default function ProcessingPage() {
  requireAdminPage();
  return (
    <PageFrame>
      <PageHeader
        title="Processing"
        description="Messages waiting for your processing computer, what it is doing now, and how each one finished. This page updates itself."
      />
      <ProcessingBoard />
    </PageFrame>
  );
}
