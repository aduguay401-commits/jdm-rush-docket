import { AccountHeader } from "@/app/account/_components/header";
import { EmptyState, PageShell, StatusPill } from "@/app/account/_components/garage-ui";
import {
  getCustomerPortalContext,
  getDocketHref,
  getDocketInvoicesForCustomer,
  getVehicleLabel,
} from "@/lib/customer/dashboard";
import { formatInvoiceAmount, formatInvoiceTypeLabel } from "@/lib/invoices/types";

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

export default async function InvoicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getCustomerPortalContext({
    nextPath: `/account/imports/${encodeURIComponent(id)}/invoices`,
    selectedDocketId: id,
    requireDocket: true,
  });
  const docket = context.selectedDocket!;
  const vehicle = getVehicleLabel(docket);
  const messagesHref = getDocketHref("/account/messages", docket.id);
  const invoices = await getDocketInvoicesForCustomer(docket.id);

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <AccountHeader
        customerName={context.customerName}
        messagesHref={messagesHref}
        unreadCount={context.unreadCount}
        title="Invoices & Receipts"
        backHref={`/account/imports/${encodeURIComponent(docket.id)}`}
        backLabel={`Back to ${vehicle}`}
        breadcrumbs={[
          { href: "/account", label: "Garage" },
          { href: "/account/imports", label: "My Active Imports" },
          { href: `/account/imports/${encodeURIComponent(docket.id)}`, label: vehicle },
        ]}
      />

      <PageShell>
        <div className="grid gap-4">
          <section className="border border-white/[0.08] bg-black p-5">
            <StatusPill tone={docket.deposit_paid ? "good" : "muted"}>
              {docket.deposit_paid ? "Deposit recorded" : "Awaiting first invoice"}
            </StatusPill>
            <h2 className="mt-3 text-[22px] font-black text-white">{vehicle}</h2>
          </section>

          {invoices.length === 0 ? (
            <EmptyState
              title="No invoices yet"
              body="Your deposit and any further invoices will appear here as they are issued. Nothing has been fabricated."
            />
          ) : (
            <section className="border border-white/[0.08] bg-black p-5">
              <div className="grid gap-3">
                {invoices.map((invoice) => {
                  const amount = formatInvoiceAmount(invoice.amount_cad);
                  const issued = formatDate(invoice.issued_at);
                  const paid = formatDate(invoice.paid_at);
                  return (
                    <article
                      className="flex flex-wrap items-start justify-between gap-3 border border-white/[0.06] bg-white/[0.02] p-4"
                      key={invoice.id}
                    >
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold text-white">{invoice.label}</p>
                        <p className="mt-1 text-[13px] text-white/50">
                          {formatInvoiceTypeLabel(invoice.invoice_type)}
                          {amount ? ` · ${amount}` : ""}
                          {issued ? ` · issued ${issued}` : ""}
                          {paid ? ` · paid ${paid}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <StatusPill tone={invoice.status === "paid" ? "good" : "muted"}>
                          {invoice.status === "paid" ? "Paid" : "Unpaid"}
                        </StatusPill>
                        {invoice.file_path ? (
                          <a
                            className="border border-white/15 px-3 py-1.5 text-[13px] font-medium text-white/80 transition hover:bg-white/10"
                            href={`/api/customer/invoices/${invoice.id}/file`}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Download
                          </a>
                        ) : null}
                        {invoice.external_url ? (
                          <a
                            className="border border-white/15 px-3 py-1.5 text-[13px] font-medium text-white/80 transition hover:bg-white/10"
                            href={invoice.external_url}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            View invoice
                          </a>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </PageShell>
    </div>
  );
}
