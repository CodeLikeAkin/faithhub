import { requireAdminPage } from "@/lib/admin-auth";
import AdminShell from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default function ConsoleLayout({ children }) {
  requireAdminPage();
  return <AdminShell>{children}</AdminShell>;
}
