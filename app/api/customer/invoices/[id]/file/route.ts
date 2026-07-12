import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createLicenseSignedUrl, logDocumentAccess } from "@/lib/storage/licenses";
import { createServerAuthClient } from "@/lib/supabase/server-auth";

export const runtime = "nodejs";

function getClientIp(headersList: Headers) {
  return headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || headersList.get("x-real-ip") || null;
}

// GET /api/customer/invoices/[id]/file — short-lived signed URL to the customer's
// own invoice PDF. Ownership is enforced by RLS: the auth-scoped read only returns
// the row if it belongs to a docket the session customer owns. Void invoices are
// hidden from customers.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createServerAuthClient();

  const { data, error } = await supabase
    .from("docket_invoices")
    .select("docket_id, file_path, status")
    .eq("id", id)
    .maybeSingle<{ docket_id: string; file_path: string | null; status: string }>();

  if (error || !data || !data.file_path || data.status === "void") {
    // RLS-blocked, missing, no file, or void — all indistinguishable 404 to the caller.
    return Response.json({ success: false, error: "Invoice document not found" }, { status: 404 });
  }

  try {
    const headersList = await headers();
    await logDocumentAccess({
      documentPath: data.file_path,
      accessedBy: "customer",
      docketId: data.docket_id,
      ipAddress: getClientIp(headersList),
    });
  } catch (logError) {
    console.error("[Invoices] customer access log failed (non-blocking):", logError);
  }

  redirect(await createLicenseSignedUrl(data.file_path, 300));
}
