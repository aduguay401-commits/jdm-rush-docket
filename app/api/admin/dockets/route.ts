import { fetchAdminDockets } from "@/lib/admin/dockets";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET() {
  if (!(await requireAdmin())) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dockets = await fetchAdminDockets();
    return Response.json({ success: true, dockets });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load dockets",
      },
      { status: 500 }
    );
  }
}
