import { redirect } from "next/navigation";

import { createSignedAgreementUrl } from "@/lib/storage/agreements";
import { createServerClient } from "@/lib/supabase/server";
import { createServerAuthClient } from "@/lib/supabase/server-auth";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const authSupabase = await createServerAuthClient();
  const { data: docket, error: docketError } = await authSupabase
    .from("dockets")
    .select("id, agreement_signed")
    .eq("id", id)
    .maybeSingle<{ id: string; agreement_signed: boolean | null }>();

  if (docketError) {
    return Response.json({ success: false, error: docketError.message }, { status: 500 });
  }

  if (!docket) {
    return Response.json({ success: false, error: "Not authorized for this docket" }, { status: 403 });
  }

  if (!docket.agreement_signed) {
    return Response.json({ success: false, error: "Agreement is not signed yet" }, { status: 404 });
  }

  const serviceSupabase = createServerClient();
  const { data: signature, error: signatureError } = await serviceSupabase
    .from("agreement_signatures")
    .select("pdf_path")
    .eq("docket_id", id)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ pdf_path: string | null }>();

  if (signatureError) {
    return Response.json({ success: false, error: signatureError.message }, { status: 500 });
  }

  if (!signature?.pdf_path) {
    return Response.json({ success: false, error: "Signed agreement PDF not found" }, { status: 404 });
  }

  redirect(await createSignedAgreementUrl(signature.pdf_path, 300));
}
