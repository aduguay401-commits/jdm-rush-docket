import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountHeader } from "@/app/account/_components/header";
import { fillAgreementTemplate } from "@/lib/agreements/fillTemplate";
import { pickTemplate } from "@/lib/agreements/templates";
import {
  getCustomerPortalContext,
  getDocketHref,
  getVehicleLabel,
  type CustomerDocket,
} from "@/lib/customer/dashboard";

import { SignClient } from "./SignClient";

function ProgressBar({ done = false }: { done?: boolean }) {
  const steps = ["Review", "Sign", "Done"];
  const activeIndex = done ? 2 : 1;

  return (
    <div className="bg-black border border-white/[0.08] px-4 py-4">
      <div className="flex items-center gap-3">
        {steps.map((step, index) => (
          <div key={step} className="flex flex-1 items-center gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center border text-[11px] font-bold ${
                  index <= activeIndex
                    ? "border-[#E55125] bg-[#E55125] text-white"
                    : "border-white/[0.12] bg-white/[0.03] text-white/35"
                }`}
              >
                {index + 1}
              </span>
              <span className={`truncate text-[11px] font-bold uppercase ${index === activeIndex ? "text-white" : "text-white/35"}`}>
                {step}
              </span>
            </div>
            {index < steps.length - 1 && <div className={`h-px flex-1 ${index < activeIndex ? "bg-[#E55125]/70" : "bg-white/[0.08]"}`} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function AgreementHeaderCard({ docket, vehicle }: { docket: CustomerDocket; vehicle: string }) {
  const template = pickTemplate(docket);

  return (
    <section className="bg-black border border-white/[0.08] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[#E55125] text-[10px] font-bold uppercase tracking-[0.12em] mb-2">Purchase Agreement</p>
          <h1 className="text-white text-[24px] sm:text-[30px] font-extrabold tracking-tight leading-tight">
            Review and Sign
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="border border-[#E55125]/35 bg-[#E55125] px-3 py-1 text-[11px] font-bold uppercase text-white">
            {vehicle}
          </span>
          <span className="border border-white/[0.12] bg-white/[0.04] px-3 py-1 text-[11px] font-bold uppercase text-white/70">
            {template.label}
          </span>
        </div>
      </div>
      {template.type === "auction" && (
        <div className="mt-5 border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-[12px] leading-relaxed text-amber-200/80">
          Auction agreement selected. This version includes the auction bidding and availability clause.
        </div>
      )}
    </section>
  );
}

function AgreementBody({ agreementText }: { agreementText: string }) {
  return (
    <section className="relative bg-black border border-white/[0.08] p-5 sm:p-6">
      <div className="pointer-events-none absolute left-0 top-0 h-full w-[3px] bg-[#E55125]/25" />
      <div className="pointer-events-none absolute inset-x-5 top-5 h-8 bg-gradient-to-b from-black to-transparent" />
      <div className="pointer-events-none absolute inset-x-5 bottom-5 h-8 bg-gradient-to-t from-black to-transparent" />
      <div className="max-h-[260px] overflow-y-auto pr-2 text-[12px] leading-relaxed text-white/70 sm:max-h-[420px]">
        {agreementText.split(/\n{2,}/).map((block, index) => (
          <p key={index} className="mb-3 whitespace-pre-line">
            {block}
          </p>
        ))}
      </div>
    </section>
  );
}

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
  const canRenderAgreement = Boolean(chosenPath);
  const template = canRenderAgreement ? pickTemplate(docket) : null;
  const agreementText = template
    ? fillAgreementTemplate(template.body, docket, {
        customer_address: "Address provided in the signing form below",
      })
    : "";

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <AccountHeader customerName={context.customerName} messagesHref={messagesHref} unreadCount={context.unreadCount} />

      <div className="bg-black border-b border-white/[0.08] px-4 sm:px-6 lg:px-8 pt-7 pb-6 sm:pt-9 sm:pb-8">
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

      <main id="main-content" className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="max-w-[1200px] mx-auto space-y-4">
          <ProgressBar done={Boolean(docket.agreement_signed)} />

          {docket.agreement_signed ? (
            <AlreadySigned vehicle={vehicle} />
          ) : !canRenderAgreement || !template ? (
            <MissingPurchasePath vehicle={vehicle} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
              <div className="space-y-4 min-w-0">
                <AgreementHeaderCard docket={docket} vehicle={vehicle} />
                <AgreementBody agreementText={agreementText} />
                <SignClient docketId={docket.id} vehicle={vehicle} />
              </div>

              <aside className="bg-black border border-white/[0.08] p-5 lg:sticky lg:top-24">
                <p className="text-[#E55125] text-[10px] font-bold uppercase tracking-[0.12em] mb-3">Vehicle Context</p>
                <h2 className="text-white text-[18px] font-extrabold leading-tight">{vehicle}</h2>
                <dl className="mt-5 space-y-3 text-[12px]">
                  <div className="flex justify-between gap-4 border-b border-white/[0.06] pb-3">
                    <dt className="text-white/35">Agreement</dt>
                    <dd className="text-white/75 font-semibold">{template.label}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-white/[0.06] pb-3">
                    <dt className="text-white/35">Customer</dt>
                    <dd className="text-white/75 font-semibold text-right">{context.customerName}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-white/35">Docket</dt>
                    <dd className="text-white/45 font-mono text-[10px] text-right">{docket.id.slice(0, 8)}</dd>
                  </div>
                </dl>
              </aside>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
