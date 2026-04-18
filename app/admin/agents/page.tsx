import { redirect } from "next/navigation";

import AgentManagementClient from "./AgentManagementClient";
import { getCurrentUserRole } from "@/lib/admin/auth";

export default async function AdminAgentsPage() {
  const { user, role } = await getCurrentUserRole();

  if (!user || role !== "admin") {
    redirect("/agent/login");
  }

  return <AgentManagementClient />;
}
