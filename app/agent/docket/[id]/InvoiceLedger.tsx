"use client";

import { useCallback, useEffect, useState } from "react";

import {
  formatInvoiceAmount,
  formatInvoiceTypeLabel,
  INVOICE_TYPE_LABELS,
  INVOICE_TYPES,
  type DocketInvoice,
  type InvoiceType,
} from "@/lib/invoices/types";

function formatDate(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) {
    return null;
  }
  return new Date(time).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function StatusChip({ status }: { status: string }) {
  const style =
    status === "paid"
      ? "border-[#22c55e]/40 bg-[#22c55e]/10 text-[#4ade80]"
      : status === "void"
        ? "border-white/15 bg-white/5 text-white/40"
        : "border-[#fbbf24]/40 bg-[#fbbf24]/10 text-[#fbbf24]";
  const label = status === "paid" ? "Paid" : status === "void" ? "Void" : "Unpaid";
  return (
    <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-full border px-2.5 text-[11px] font-semibold uppercase tracking-wide ${style}`}>
      {label}
    </span>
  );
}

export function InvoiceLedger({ docketId, onDepositSynced }: { docketId: string; onDepositSynced?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [invoices, setInvoices] = useState<DocketInvoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [depositHint, setDepositHint] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<InvoiceType>("deposit");
  const [addLabel, setAddLabel] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addIssued, setAddIssued] = useState("");
  const [addFile, setAddFile] = useState<File | null>(null);
  const [addExternalUrl, setAddExternalUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/agent/invoices?docketId=${encodeURIComponent(docketId)}`);
      const data = (await response.json()) as {
        success?: boolean;
        enabled?: boolean;
        invoices?: DocketInvoice[];
        error?: string;
      };
      if (!response.ok || !data.success) {
        setError(data.error ?? "Failed to load invoices.");
        return;
      }
      setEnabled(data.enabled !== false);
      setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
      setError(null);
    } catch {
      setError("Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  }, [docketId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleStatus(invoice: DocketInvoice, nextStatus: "paid" | "unpaid" | "void") {
    setPendingId(invoice.id);
    setError(null);
    setDepositHint(null);
    try {
      const response = await fetch(`/api/agent/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = (await response.json()) as { success?: boolean; invoice?: DocketInvoice; depositSynced?: boolean; error?: string };
      if (!response.ok || !data.success || !data.invoice) {
        throw new Error(data.error ?? "Update failed.");
      }
      const updated = data.invoice;
      setInvoices((prev) => prev.map((item) => (item.id === invoice.id ? updated : item)));
      if (data.depositSynced) {
        setDepositHint("Deposit gate marked paid from this invoice.");
        onDepositSynced?.();
      } else if (invoice.invoice_type === "deposit" && nextStatus !== "paid") {
        setDepositHint("The deposit gate stays as-is — adjust it from the Purchase Close-Out button if needed.");
      }
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Update failed.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleSaveLink(invoice: DocketInvoice) {
    setLinkSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/agent/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ external_url: linkDraft.trim() }),
      });
      const data = (await response.json()) as { success?: boolean; invoice?: DocketInvoice; error?: string };
      if (!response.ok || !data.success || !data.invoice) {
        throw new Error(data.error ?? "Failed to save link.");
      }
      const updated = data.invoice;
      setInvoices((prev) => prev.map((item) => (item.id === invoice.id ? updated : item)));
      setEditingLinkId(null);
      setLinkDraft("");
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "Failed to save link.");
    } finally {
      setLinkSaving(false);
    }
  }

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!addLabel.trim()) {
      setAddError("A label is required.");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const form = new FormData();
      form.set("docketId", docketId);
      form.set("invoice_type", addType);
      form.set("label", addLabel.trim());
      if (addAmount.trim()) {
        form.set("amount_cad", addAmount.trim());
      }
      if (addIssued.trim()) {
        form.set("issued_at", addIssued.trim());
      }
      if (addFile) {
        form.set("file", addFile);
      }
      if (addExternalUrl.trim()) {
        form.set("external_url", addExternalUrl.trim());
      }
      const response = await fetch("/api/agent/invoices", { method: "POST", body: form });
      const data = (await response.json()) as { success?: boolean; invoice?: DocketInvoice; error?: string };
      if (!response.ok || !data.success || !data.invoice) {
        throw new Error(data.error ?? "Failed to add invoice.");
      }
      const created = data.invoice;
      setInvoices((prev) => [created, ...prev]);
      setShowAdd(false);
      setAddType("deposit");
      setAddLabel("");
      setAddAmount("");
      setAddIssued("");
      setAddFile(null);
      setAddExternalUrl("");
    } catch (submitError) {
      setAddError(submitError instanceof Error ? submitError.message : "Failed to add invoice.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <section className="rounded-xl border border-white/12 bg-[#171717] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Invoices</h2>
          <p className="mt-1 text-sm text-white/60">Record deposit, balance, and transport invoices. Optional PDF upload.</p>
        </div>
        {enabled ? (
          <button
            className="shrink-0 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10"
            onClick={() => setShowAdd((previous) => !previous)}
            type="button"
          >
            {showAdd ? "Cancel" : "Add Invoice"}
          </button>
        ) : null}
      </div>

      {loading ? <p className="mt-4 text-sm text-white/60">Loading invoices…</p> : null}

      {!loading && !enabled ? (
        <p className="mt-4 rounded-lg border border-dashed border-white/15 bg-black/20 p-4 text-sm text-white/55">
          Invoice records are not enabled yet. Once the invoice table is live this ledger activates automatically.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {depositHint ? <p className="mt-3 text-sm text-[#7dd3fc]">{depositHint}</p> : null}

      {!loading && enabled && showAdd ? (
        <form className="mt-4 grid gap-3 rounded-lg border border-white/10 bg-black/20 p-4 sm:grid-cols-2" onSubmit={handleAdd}>
          <label className="flex flex-col gap-1 text-xs text-white/60">
            Type
            <select
              className="rounded-lg border border-white/15 bg-[#111] px-3 py-2 text-sm text-white"
              onChange={(event) => setAddType(event.target.value as InvoiceType)}
              value={addType}
            >
              {INVOICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {INVOICE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/60">
            Label
            <input
              className="rounded-lg border border-white/15 bg-[#111] px-3 py-2 text-sm text-white"
              onChange={(event) => setAddLabel(event.target.value)}
              placeholder="Invoice #2 — Vehicle balance"
              type="text"
              value={addLabel}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/60">
            Amount (CAD, optional)
            <input
              className="rounded-lg border border-white/15 bg-[#111] px-3 py-2 text-sm text-white"
              inputMode="decimal"
              onChange={(event) => setAddAmount(event.target.value)}
              placeholder="5000.00"
              type="text"
              value={addAmount}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/60">
            Issued date (optional)
            <input
              className="rounded-lg border border-white/15 bg-[#111] px-3 py-2 text-sm text-white"
              onChange={(event) => setAddIssued(event.target.value)}
              type="date"
              value={addIssued}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/60 sm:col-span-2">
            PDF / image (optional)
            <input
              accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
              className="text-sm text-white/80 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-white"
              onChange={(event) => setAddFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/60 sm:col-span-2">
            QuickBooks / invoice link (optional)
            <input
              className="rounded-lg border border-white/15 bg-[#111] px-3 py-2 text-sm text-white"
              onChange={(event) => setAddExternalUrl(event.target.value)}
              placeholder="https://quickbooks.intuit.com/..."
              type="url"
              value={addExternalUrl}
            />
          </label>
          {addError ? <p className="text-sm text-red-300 sm:col-span-2">{addError}</p> : null}
          <div className="sm:col-span-2">
            <button
              className="rounded-lg bg-[#E55125] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={adding}
              type="submit"
            >
              {adding ? "Saving…" : "Save Invoice"}
            </button>
          </div>
        </form>
      ) : null}

      {!loading && enabled && invoices.length === 0 && !showAdd ? (
        <p className="mt-4 text-sm text-white/50">No invoices recorded yet.</p>
      ) : null}

      {!loading && enabled && invoices.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {invoices.map((invoice) => {
            const amount = formatInvoiceAmount(invoice.amount_cad);
            const issued = formatDate(invoice.issued_at);
            const paid = formatDate(invoice.paid_at);
            const isPending = pendingId === invoice.id;
            const isVoid = invoice.status === "void";
            return (
              <article
                className={`rounded-lg border border-white/10 bg-black/20 p-4 ${isVoid ? "opacity-60" : ""}`}
                key={invoice.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">{invoice.label}</p>
                      <StatusChip status={invoice.status} />
                    </div>
                    <p className="mt-1 text-xs text-white/55">
                      {formatInvoiceTypeLabel(invoice.invoice_type)}
                      {amount ? ` · ${amount}` : ""}
                      {issued ? ` · issued ${issued}` : ""}
                      {paid ? ` · paid ${paid}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {invoice.external_url ? (
                      <a
                        className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10"
                        href={invoice.external_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        View invoice
                      </a>
                    ) : null}
                    {invoice.file_path ? (
                      <a
                        className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10"
                        href={`/api/agent/invoices/${invoice.id}/file`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        View PDF
                      </a>
                    ) : null}
                    {!isVoid ? (
                      <>
                        <button
                          className="rounded-lg border border-[#22c55e]/40 px-3 py-1.5 text-xs font-medium text-[#4ade80] transition hover:bg-[#22c55e]/10 disabled:opacity-60"
                          disabled={isPending}
                          onClick={() => handleStatus(invoice, invoice.status === "paid" ? "unpaid" : "paid")}
                          type="button"
                        >
                          {invoice.status === "paid" ? "Mark Unpaid" : "Mark Paid"}
                        </button>
                        <button
                          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/60 transition hover:bg-white/10 disabled:opacity-60"
                          disabled={isPending}
                          onClick={() => handleStatus(invoice, "void")}
                          type="button"
                        >
                          Void
                        </button>
                        {editingLinkId === invoice.id ? (
                          <span className="inline-flex items-center gap-1">
                            <input
                              className="w-44 rounded-lg border border-white/15 bg-[#111] px-2 py-1 text-xs text-white"
                              onChange={(event) => setLinkDraft(event.target.value)}
                              placeholder="https://..."
                              type="url"
                              value={linkDraft}
                            />
                            <button
                              className="rounded-lg border border-[#E55125] px-2 py-1 text-xs font-medium text-[#E55125] disabled:opacity-60"
                              disabled={linkSaving}
                              onClick={() => handleSaveLink(invoice)}
                              type="button"
                            >
                              {linkSaving ? "…" : "Save"}
                            </button>
                            <button
                              className="rounded-lg border border-white/15 px-2 py-1 text-xs text-white/60"
                              onClick={() => { setEditingLinkId(null); setLinkDraft(""); }}
                              type="button"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/60 transition hover:bg-white/10"
                            onClick={() => { setEditingLinkId(invoice.id); setLinkDraft(invoice.external_url ?? ""); }}
                            type="button"
                          >
                            {invoice.external_url ? "Edit link" : "Add link"}
                          </button>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
