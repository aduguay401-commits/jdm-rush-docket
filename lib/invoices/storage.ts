import "server-only";

import { CUSTOMER_DOCUMENTS_BUCKET } from "@/lib/storage/licenses";
import { createServerClient } from "@/lib/supabase/server";

export const MAX_INVOICE_BYTES = 15 * 1024 * 1024;

const INVOICE_MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
};

export function getInvoiceExtension(mimeType: string): string | null {
  return INVOICE_MIME_EXTENSIONS[mimeType] ?? null;
}

// D4 pattern: UUID filenames (never the original name), private customer-documents
// bucket, path <docketId>/invoices/<uuid>.<ext>. Fail-closed validation.
export async function uploadInvoiceDocument({ docketId, file }: { docketId: string; file: File }): Promise<string> {
  const extension = getInvoiceExtension(file.type);
  if (!extension) {
    throw new Error("Invoice file must be a PDF, JPG, PNG, WEBP, or HEIC");
  }
  if (file.size <= 0 || file.size > MAX_INVOICE_BYTES) {
    throw new Error("Invoice file must be between 1 byte and 15 MB");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `${docketId}/invoices/${crypto.randomUUID()}.${extension}`;
  const supabase = createServerClient();
  const { error } = await supabase.storage.from(CUSTOMER_DOCUMENTS_BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }
  return path;
}

// A missing docket_invoices table (migration 014 not yet run) must degrade to a
// quiet "not enabled" state, never a 500.
export function isMissingInvoicesTable(error: { message?: string | null } | null | undefined): boolean {
  const message = (error?.message ?? "").toLowerCase();
  return (
    message.includes("docket_invoices") ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("relation")
  );
}
