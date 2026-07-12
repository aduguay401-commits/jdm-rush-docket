import { requireAdminOrAgent } from "@/lib/admin/auth";
import { isInvoiceType } from "@/lib/invoices/types";
import { isMissingInvoicesTable, uploadInvoiceDocument } from "@/lib/invoices/storage";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const INVOICE_SELECT = "id, docket_id, invoice_type, label, amount_cad, status, issued_at, paid_at, file_path, external_url, created_at, updated_at";

// GET /api/agent/invoices?docketId=... — list a docket's invoice ledger (service role).
// Fail-open: if migration 014 has not run yet, respond enabled:false (never 500).
export async function GET(request: Request) {
  if (!(await requireAdminOrAgent())) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  const docketId = new URL(request.url).searchParams.get("docketId")?.trim() ?? "";
  if (!docketId) {
    return Response.json({ success: false, error: "docketId is required" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("docket_invoices")
    .select(INVOICE_SELECT)
    .eq("docket_id", docketId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingInvoicesTable(error)) {
      return Response.json({ success: true, enabled: false, invoices: [] });
    }
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }

  return Response.json({ success: true, enabled: true, invoices: data ?? [] });
}

function toAmount(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const parsed = Number(value.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function toIssuedAt(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : null;
}

// POST /api/agent/invoices — create an invoice (optionally with a PDF/image upload).
// multipart/form-data: docketId, invoice_type, label, amount_cad?, issued_at?, file?
export async function POST(request: Request) {
  if (!(await requireAdminOrAgent())) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const docketId = (form.get("docketId") as string | null)?.trim() ?? "";
    const invoiceType = (form.get("invoice_type") as string | null)?.trim() ?? "";
    const label = (form.get("label") as string | null)?.trim() ?? "";

    if (!docketId) {
      return Response.json({ success: false, error: "docketId is required" }, { status: 400 });
    }
    if (!isInvoiceType(invoiceType)) {
      return Response.json({ success: false, error: "Invalid invoice type" }, { status: 400 });
    }
    if (!label) {
      return Response.json({ success: false, error: "A label is required" }, { status: 400 });
    }

    const amountCad = toAmount(form.get("amount_cad"));
    const issuedAt = toIssuedAt(form.get("issued_at"));
    const externalUrlRaw = (form.get("external_url") as string | null)?.trim() ?? "";
    if (externalUrlRaw.length > 0 && !/^https?:\/\//i.test(externalUrlRaw)) {
      return Response.json({ success: false, error: "Invoice link must start with http(s)://" }, { status: 400 });
    }
    const externalUrl = externalUrlRaw.length > 0 ? externalUrlRaw : null;

    // Optional file upload (fail-closed validation lives in uploadInvoiceDocument).
    let filePath: string | null = null;
    const file = form.get("file");
    if (file instanceof File && file.size > 0) {
      try {
        filePath = await uploadInvoiceDocument({ docketId, file });
      } catch (uploadError) {
        return Response.json(
          { success: false, error: uploadError instanceof Error ? uploadError.message : "Upload failed" },
          { status: 400 },
        );
      }
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("docket_invoices")
      .insert({
        docket_id: docketId,
        invoice_type: invoiceType,
        label,
        amount_cad: amountCad,
        issued_at: issuedAt,
        file_path: filePath,
        external_url: externalUrl,
      })
      .select(INVOICE_SELECT)
      .maybeSingle();

    if (error) {
      if (isMissingInvoicesTable(error)) {
        return Response.json(
          { success: false, enabled: false, error: "Invoice records are not enabled yet (migration 014 pending)." },
          { status: 409 },
        );
      }
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, invoice: data });
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}
