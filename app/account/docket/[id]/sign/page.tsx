import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountHeader } from "@/app/account/_components/header";
import { fillAgreementTemplate } from "@/lib/agreements/fillTemplate";
import { pickTemplate } from "@/lib/agreements/templates";
import {
  getCustomerPortalContext,
  getDocketHref,
  getVehicleLabel,
} from "@/lib/customer/dashboard";

import { SignClient } from "./SignClient";

function MissingPurchasePath({ vehicle }: { vehicle: string }) {
  return (
    <section className="bg-black border border-amber-400/20 p-6 sm:p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-amber-400/40 bg-amber-400/10 text-xl text-amber-300">
        !
      </div>
      <h1 className="text-white text-[24px] font-extrabold tracking-tight">Agreement Not Ready</h1>
      <p className="mt-3 text-white/55 text-[13px] leading-relaxed">
        The purchase path for {vehicle} has not been selected yet. JDM Rush will send the correct agreement after your auction or dealer path is locked.
      </p>
    </section>
  );
}

function AlreadySigned({ vehicle }: { vehicle: string }) {
  return (
    <section className="bg-black border border-emerald-400/20 p-6 sm:p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-emerald-400/40 bg-emerald-400/10 text-2xl text-emerald-300">
        ✓
      </div>
      <h1 className="text-white text-[24px] font-extrabold tracking-tight">Agreement Signed</h1>
      <p className="mt-3 text-white/55 text-[13px] leading-relaxed">
        The purchase agreement for {vehicle} has already been signed. A copy was emailed to you and is available in your document vault.
      </p>
      <Link
        href="/account/documents"
        className="mt-6 inline-flex border border-[#E55125] bg-[#E55125] px-4 py-2 text-[13px] font-bold text-white transition hover:brightness-110"
      >
        Open Document Vault
      </Link>
    </section>
  );
}

export default async function SignAgreementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await getCustomerPortalContext({
    nextPath: `/account/docket/${encodeURIComponent(id)}/sign`,
    selectedDocketId: id,
    requireDocket: true,
  });
  const docket = context.selectedDocket;

  if (!docket) notFound();

  const vehicle = getVehicleLabel(docket);
  const messagesHref = getDocketHref("/account/messages", docket.id);
  const carHref = getDocketHref("/account/car", docket.id);
  const chosenPath = docket.chosen_path ?? docket.selected_path;
  const template = chosenPath ? pickTemplate(docket) : null;
  const agreementText = template
    ? fillAgreementTemplate(template.body, docket, {
        customer_address: "Address provided in the signing form below",
      })
    : "";

  return (
    <div className="min-h-screen max-w-[100vw] overflow-x-hidden bg-[#111111] text-white">
      <AccountHeader customerName={context.customerName} messagesHref={messagesHref} unreadCount={context.unreadCount} />

      <div className="max-w-[100vw] overflow-x-hidden bg-black border-b border-white/[0.08] px-4 sm:px-6 lg:px-8 pt-7 pb-6 sm:pt-9 sm:pb-8">
        <div className="max-w-[1200px] mx-auto">
          <Link href={carHref} className="inline-flex items-center gap-1.5 text-white/30 hover:text-white/70 text-[12px] font-medium transition-colors mb-4">
            <span aria-hidden>←</span>
            Back to {vehicle}
          </Link>
          <p className="text-white/25 text-[10px] font-bold uppercase tracking-[0.12em] mb-2">{vehicle}</p>
          <h1 className="text-[#E55125] font-extrabold tracking-tight leading-none" style={{ fontSize: "clamp(26px, 5vw, 38px)" }}>
            Purchase Agreement
          </h1>
        </div>
      </div>

      <main id="main-content" className="max-w-[100vw] overflow-x-hidden px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="max-w-[1200px] mx-auto">
          {docket.agreement_signed ? (
            <AlreadySigned vehicle={vehicle} />
          ) : !template ? (
            <MissingPurchasePath vehicle={vehicle} />
          ) : (
            <SignClient
              docketId={docket.id}
              vehicle={vehicle}
              customerName={context.customerName}
              agreementText={agreementText}
              agreementLabel={template.label}
              agreementType={template.type}
            />
          )}
        </div>
      </main>
    </div>
  );
}
