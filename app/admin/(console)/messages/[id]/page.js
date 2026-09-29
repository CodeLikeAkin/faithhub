import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-auth";
import { UUID_RE } from "@/lib/admin-api";
import { isMissingSetup } from "@/lib/admin-dashboard";
import { loadMessage } from "@/lib/admin-message";
import { PageFrame } from "@/components/admin/PageHeader";
import MessageDetail from "@/components/admin/MessageDetail";
import SetupNeeded from "@/components/admin/SetupNeeded";
import { Notice } from "@/components/admin/controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Message - FaithHub Admin" };

export default async function MessagePage({ params }) {
  requireAdminPage();
  if (!UUID_RE.test(params.id)) notFound();

  let message = null;
  let error = null;
  try {
    message = await loadMessage(params.id);
  } catch (e) {
    error = e;
  }
  if (!error && !message) notFound();

  return (
    <PageFrame>
      {isMissingSetup(error) ? (
        <SetupNeeded file="admin_stage3.sql" />
      ) : error ? (
        <Notice tone="error">Couldn&apos;t load this message. Reload in a minute.</Notice>
      ) : (
        <MessageDetail message={message} />
      )}
    </PageFrame>
  );
}
