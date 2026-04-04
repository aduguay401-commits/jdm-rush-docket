import { redirect } from "next/navigation";

import AdminDashboardClient from "./AdminDashboardClient";
import { fetchAdminDockets } from "@/lib/admin/dockets";
import { getCurrentUserRole } from "@/lib/admin/auth";

export default async function AdminDashboardPage() {
  const { user, role } = await getCurrentUserRole();

  if (!user || role !== "admin") {
    redirect("/agent/login");
  }

  const dockets = await fetchAdminDockets();

  return <AdminDashboardClient initialDockets={dockets} />;
}
