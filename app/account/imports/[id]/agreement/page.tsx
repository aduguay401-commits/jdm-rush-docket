import Link from "next/link";
import { AccountHeader } from "@/app/account/_components/header";
import { EmptyState, PageShell, StatusPill } from "@/app/account/_components/garage-ui";
import {
  formatShortDate,
  getAgreementSentAt,
  getCustomerPortalContext,
  getDocketHref,
  getVehicleLabel,
} from "@/lib/customer/dashboard";

export default async function LegalAgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getCustomerPortalContext({
    nextPath: `/account/imports/${encodeURIComponent(id)}/agreement`,
    selectedDocketId: id,
    requireDocket: true,
  });
  const docket = context.selectedDocket!;
  const vehicle = getVehicleLabel(docket);
  const messagesHref = getDocketHref("/account/messages", docket.id);
  const agreementSentAt = await getAgreementSentAt(docket.id);
  const agreementHref = docket.agreement_signed
    ? `/api/customer/docket/${encodeURIComponent(docket.id)}/agreement`
    : agreementSentAt
      ? `/account/docket/${encodeURIComponent(docket.id)}/sign`
      : null;

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <AccountHeader
        customerName={context.customerName}
        messagesHref={messagesHref}
        unreadCount={context.unreadCount}
        title="Legal Agreement"
        backHref={`/account/imports/${encodeURIComponent(docket.id)}`}
        backLabel={`Back to ${vehicle}`}
        breadcrumbs={[
          { href: "/account", label: "Garage" },
          { href: "/account/imports", label: "Active Imports" },
          { href: `/account/imports/${encodeURIComponent(docket.id)}`, label: vehicle },
        ]}
      />

      <PageShell>
        <section className="border border-white/[0.08] bg-black p-5 sm:p-6">
          <StatusPill tone={docket.agreement_signed ? "good" : agreementSentAt ? "accent" : "muted"}>
            {docket.agreement_signed ? "Signed" : agreementSentAt ? "Ready to sign" : "Not sent yet"}
          </StatusPill>
          <h2 className="mt-3 text-[24px] font-black leading-tight text-white">Purchase Agreement</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-white/40">
            {docket.agreement_signed
              ? `Signed agreement for ${vehicle}.`
              : agreementSentAt
                ? `Sent ${formatShortDate(agreementSentAt) ?? "recently"} and ready for your signature.`
                : "JDM Rush has not sent the agreement for this import yet."}
          </p>

          {agreementHref ? (
            <Link href={agreementHref} className="mt-6 inline-flex min-h-12 w-full items-center justify-center bg-[#E55125] px-5 text-[13px] font-black uppercase text-white transition hover:brightness-110 sm:w-auto">
              {docket.agreement_signed ? "View Signed Agreement" : "Sign Agreement"}
            </Link>
          ) : (
            <div className="mt-6">
              <EmptyState title="Agreement not ready yet" body="This page will link to the signing flow as soon as JDM Rush sends the purchase agreement." />
            </div>
          )}
        </section>
      </PageShell>
    </div>
  );
}
