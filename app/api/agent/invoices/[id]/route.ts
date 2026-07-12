import { requireAdminOrAgent } from "@/lib/admin/auth";
import { isInvoiceStatus } from "@/lib/invoices/types";
import { isMissingInvoicesTable } from "@/lib/invoices/storage";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const INVOICE_SELECT = "id, docket_id, invoice_type, label, amount_cad, status, issued_at, paid_at, file_path, external_url, created_at, updated_at";

type PatchPayload = {
  status?: string;
  external_url?: string;
};

// PATCH /api/agent/invoices/[id] — edit an invoice's status and/or its external
// link. Strict whitelist: only `status` and `external_url`. Marking a DEPOSIT-type
// invoice paid also flips dockets.deposit_paid = true (the A-chain gate); unmarking
// never auto-clears it — the gate stays human-controlled via the close-out button.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminOrAgent())) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const payload = (await request.json()) as PatchPayload;

    const hasStatus = Object.prototype.hasOwnProperty.call(payload, "status");
    const hasExternalUrl = Object.prototype.hasOwnProperty.call(payload, "external_url");

    if (!hasStatus && !hasExternalUrl) {
      return Response.json({ success: false, error: "No valid fields provided" }, { status: 400 });
    }

    let nextStatus: string | undefined;
    if (hasStatus) {
      if (!isInvoiceStatus(payload.status)) {
        return Response.json({ success: false, error: "Invalid status" }, { status: 400 });
      }
      nextStatus = payload.status;
    }

    let externalUrl: string | null | undefined;
    if (hasExternalUrl) {
      const raw = typeof payload.external_url === "string" ? payload.external_url.trim() : "";
      if (raw.length === 0) {
        externalUrl = null; // an empty value clears the link
      } else if (!/^https?:\/\//i.test(raw)) {
        return Response.json({ success: false, error: "Invoice link must start with http(s)://" }, { status: 400 });
      } else {
        externalUrl = raw;
      }
    }

    const supabase = createServerClient();

    const { data: current, error: fetchError } = await supabase
      .from("docket_invoices")
      .select("id, docket_id, invoice_type, status")
      .eq("id", id)
      .maybeSingle<{ id: string; docket_id: string; invoice_type: string; status: string }>();

    if (fetchError) {
      if (isMissingInvoicesTable(fetchError)) {
        return Response.json(
          { success: false, enabled: false, error: "Invoice records are not enabled yet." },
          { status: 409 },
        );
      }
      return Response.json({ success: false, error: fetchError.message }, { status: 500 });
    }

    if (!current) {
      return Response.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const updates: Record<string, unknown> = { updated_at: nowIso };
    if (hasStatus) {
      updates.status = nextStatus;
      updates.paid_at = nextStatus === "paid" ? nowIso : null;
    }
    if (hasExternalUrl) {
      updates.external_url = externalUrl;
    }

    const { data: updated, error: updateError } = await supabase
      .from("docket_invoices")
      .update(updates)
      .eq("id", id)
      .select(INVOICE_SELECT)
      .maybeSingle();

    if (updateError) {
      return Response.json({ success: false, error: updateError.message }, { status: 500 });
    }

    // Sync rule: a paid deposit invoice flips the deposit gate. Never auto-clears.
    let depositSynced = false;
    if (hasStatus && current.invoice_type === "deposit" && nextStatus === "paid") {
      const { error: docketError } = await supabase
        .from("dockets")
        .update({ deposit_paid: true })
        .eq("id", current.docket_id);
      if (!docketError) {
        depositSynced = true;
      } else {
        console.error("[Invoices] deposit_paid sync failed:", docketError.message);
      }
    }

    return Response.json({ success: true, invoice: updated, depositSynced });
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}
