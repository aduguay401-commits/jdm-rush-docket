import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireAdminOrAgent } from "@/lib/admin/auth";
import { createLicenseSignedUrl, logDocumentAccess } from "@/lib/storage/licenses";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function getClientIp(headersList: Headers) {
  return headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || headersList.get("x-real-ip") || null;
}

// GET /api/agent/invoices/[id]/file — short-lived signed URL to an invoice PDF (D4 pattern + access log).
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminOrAgent())) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await context.params;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("docket_invoices")
    .select("docket_id, file_path")
    .eq("id", id)
    .maybeSingle<{ docket_id: string; file_path: string | null }>();

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
  if (!data?.file_path) {
    return Response.json({ success: false, error: "Invoice document not found" }, { status: 404 });
  }

  try {
    const headersList = await headers();
    await logDocumentAccess({
      documentPath: data.file_path,
      accessedBy: "agent",
      docketId: data.docket_id,
      ipAddress: getClientIp(headersList),
    });
  } catch (logError) {
    console.error("[Invoices] access log failed (non-blocking):", logError);
  }

  redirect(await createLicenseSignedUrl(data.file_path, 300));
}
