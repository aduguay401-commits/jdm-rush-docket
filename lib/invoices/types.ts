// Client-safe invoice vocabulary shared by the agent ledger UI, the API routes,
// and the customer page. (No server-only imports here.)

export const INVOICE_TYPES = ["deposit", "balance", "transport", "other"] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  deposit: "Deposit",
  balance: "Vehicle balance",
  transport: "Inland transport",
  other: "Other",
};

export const INVOICE_STATUSES = ["unpaid", "paid", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type DocketInvoice = {
  id: string;
  docket_id: string;
  invoice_type: string;
  label: string;
  amount_cad: number | null;
  status: string;
  issued_at: string | null;
  paid_at: string | null;
  file_path: string | null;
  external_url: string | null;
  created_at: string;
  updated_at: string;
};

export function isInvoiceType(value: unknown): value is InvoiceType {
  return typeof value === "string" && (INVOICE_TYPES as readonly string[]).includes(value);
}

export function isInvoiceStatus(value: unknown): value is InvoiceStatus {
  return typeof value === "string" && (INVOICE_STATUSES as readonly string[]).includes(value);
}

export function formatInvoiceTypeLabel(invoiceType: string): string {
  return isInvoiceType(invoiceType) ? INVOICE_TYPE_LABELS[invoiceType] : "Other";
}

export function formatInvoiceAmount(amountCad: number | null | undefined): string | null {
  if (amountCad == null || !Number.isFinite(amountCad)) {
    return null;
  }
  return `$${amountCad.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CAD`;
}
