import { requireAdmin } from "@/lib/admin/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createServerClient();

  const deletedAuthUser = await supabase.auth.admin.deleteUser(id);
  if (deletedAuthUser.error) {
    return Response.json({ success: false, error: deletedAuthUser.error.message }, { status: 500 });
  }

  const { error: profileDeleteError } = await supabase.from("profiles").delete().eq("id", id);
  if (profileDeleteError) {
    return Response.json({ success: false, error: profileDeleteError.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
