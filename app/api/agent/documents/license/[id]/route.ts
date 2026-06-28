import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireAdminOrAgent } from "@/lib/admin/auth";
import { createLicenseSignedUrl, logDocumentAccess } from "@/lib/storage/licenses";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function getClientIp(headersList: Headers) {
  return headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || headersList.get("x-real-ip") || null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminOrAgent();
  if (!auth) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await context.params;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("agreement_signatures")
    .select("docket_id, license_path")
    .eq("id", id)
    .maybeSingle<{ docket_id: string; license_path: string | null }>();

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }

  if (!data?.license_path) {
    return Response.json({ success: false, error: "License document not found" }, { status: 404 });
  }

  const headersList = await headers();
  await logDocumentAccess({
    documentPath: data.license_path,
    accessedBy: "agent",
    docketId: data.docket_id,
    ipAddress: getClientIp(headersList),
  });

  redirect(await createLicenseSignedUrl(data.license_path, 300));
}
