import { requireAdminOrAgent } from "@/lib/admin/auth";
import { isInvoiceStatus } from "@/lib/invoices/types";
import { isMissingInvoicesTable } from "@/lib/invoices/storage";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const INVOICE_SELECT = "id, docket_id, invoice_type, label, amount_cad, status, issued_at, paid_at, file_path, created_at, updated_at";

type PatchPayload = {
  status?: string;
};

// PATCH /api/agent/invoices/[id] — change an invoice's status (unpaid | paid | void).
// Strict whitelist: only `status`. Marking a DEPOSIT-type invoice paid also flips
// dockets.deposit_paid = true (the A-chain gate). Unmarking never auto-clears it —
// the gate stays human-controlled via the close-out button.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminOrAgent())) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const payload = (await request.json()) as PatchPayload;
    const nextStatus = payload.status;

    if (!isInvoiceStatus(nextStatus)) {
      return Response.json({ success: false, error: "Invalid status" }, { status: 400 });
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
    const { data: updated, error: updateError } = await supabase
      .from("docket_invoices")
      .update({
        status: nextStatus,
        paid_at: nextStatus === "paid" ? nowIso : null,
        updated_at: nowIso,
      })
      .eq("id", id)
      .select(INVOICE_SELECT)
      .maybeSingle();

    if (updateError) {
      return Response.json({ success: false, error: updateError.message }, { status: 500 });
    }

    // Sync rule: a paid deposit invoice flips the deposit gate. Never auto-clears.
    let depositSynced = false;
    if (current.invoice_type === "deposit" && nextStatus === "paid") {
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
