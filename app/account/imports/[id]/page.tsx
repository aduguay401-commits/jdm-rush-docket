import { AccountHeader } from "@/app/account/_components/header";
import { JourneyMiniTrack, PageShell, SpokeRow, StatusPill } from "@/app/account/_components/garage-ui";
import {
  getAgreementSentAt,
  getCustomerPortalContext,
  getDocketHref,
  getVehicleLabel,
  isShippingUnlocked,
} from "@/lib/customer/dashboard";

export default async function ImportHubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getCustomerPortalContext({
    nextPath: `/account/imports/${encodeURIComponent(id)}`,
    selectedDocketId: id,
    requireDocket: true,
  });
  const docket = context.selectedDocket!;
  const vehicle = getVehicleLabel(docket);
  const messagesHref = getDocketHref("/account/messages", docket.id);
  const agreementSentAt = await getAgreementSentAt(docket.id);
  const agreementStatus = docket.agreement_signed ? "Signed" : agreementSentAt ? "Ready" : "Pending";

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <AccountHeader
        customerName={context.customerName}
        messagesHref={messagesHref}
        unreadCount={context.unreadCount}
        title={vehicle}
        backHref="/account/imports"
        backLabel="Back to My Active Imports"
        breadcrumbs={[
          { href: "/account", label: "Garage" },
          { href: "/account/imports", label: "My Active Imports" },
        ]}
      />

      <PageShell>
        <div className="grid gap-4">
          <section className="border border-white/[0.08] bg-black">
            <div className="flex h-[160px] items-center justify-center bg-[#0a0a0a] text-white/[0.08]">
              <span className="text-[48px] font-black tracking-tight">JDM</span>
            </div>
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={isShippingUnlocked(docket) ? "accent" : "muted"}>
                  {isShippingUnlocked(docket) ? "Import setup pending" : "Journey pending"}
                </StatusPill>
                <StatusPill tone={docket.agreement_signed ? "good" : "muted"}>Agreement {agreementStatus}</StatusPill>
              </div>
              <div className="mt-5">
                <JourneyMiniTrack currentStep={1} />
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-white/35">
                Shipping-stage data is not tracked in this portal yet, so the journey starts at Purchased until JDM Rush adds the import milestone record.
              </p>
            </div>
          </section>

          <section className="grid gap-3">
            <SpokeRow href={`/account/imports/${encodeURIComponent(docket.id)}/vehicle`} icon="car" title="Vehicle Info" sub="Car details and any real sourced vehicle information available today." status="Real data" />
            <SpokeRow href={`/account/imports/${encodeURIComponent(docket.id)}/invoices`} icon="receipt" title="Invoices & Receipts" sub="Deposit and final invoice structure is ready; invoice files are not available yet." status="Coming soon" />
            <SpokeRow href={`/account/imports/${encodeURIComponent(docket.id)}/documents`} icon="document" title="Import Documents" sub="Shipping and customs documents will appear when the import phase is built." status="Coming soon" />
            <SpokeRow href={`/account/imports/${encodeURIComponent(docket.id)}/agreement`} icon="agreement" title="Legal Agreement" sub="Open, sign, or download the purchase agreement for this import." status={agreementStatus} />
          </section>
        </div>
      </PageShell>
    </div>
  );
}
