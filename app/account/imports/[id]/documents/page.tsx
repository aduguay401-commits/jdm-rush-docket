import { AccountHeader } from "@/app/account/_components/header";
import { EmptyState, PageShell, StatusPill } from "@/app/account/_components/garage-ui";
import { getCustomerPortalContext, getDocketHref, getVehicleLabel } from "@/lib/customer/dashboard";

export default async function ImportDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getCustomerPortalContext({
    nextPath: `/account/imports/${encodeURIComponent(id)}/documents`,
    selectedDocketId: id,
    requireDocket: true,
  });
  const docket = context.selectedDocket!;
  const vehicle = getVehicleLabel(docket);
  const messagesHref = getDocketHref("/account/messages", docket.id);

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <AccountHeader
        customerName={context.customerName}
        messagesHref={messagesHref}
        unreadCount={context.unreadCount}
        title="Import Documents"
        backHref={`/account/imports/${encodeURIComponent(docket.id)}`}
        backLabel={`Back to ${vehicle}`}
        breadcrumbs={[
          { href: "/account", label: "Garage" },
          { href: "/account/imports", label: "Active Imports" },
          { href: `/account/imports/${encodeURIComponent(docket.id)}`, label: vehicle },
        ]}
      />

      <PageShell>
        <div className="grid gap-4">
          <section className="border border-white/[0.08] bg-black p-5">
            <StatusPill>Not yet available</StatusPill>
            <h2 className="mt-3 text-[22px] font-black text-white">{vehicle}</h2>
          </section>
          <EmptyState
            title="Shipping and customs documents are not available yet"
            body="Bill of lading, export certificates, customs paperwork, and shipping files will appear here when those lifecycle records exist. This page intentionally shows an empty state today."
          />
        </div>
      </PageShell>
    </div>
  );
}
