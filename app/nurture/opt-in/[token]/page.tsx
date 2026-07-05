import { headers } from "next/headers";
import Link from "next/link";

import { AuthPageShell } from "@/app/account/_components/AuthPageShell";
import { ErrorBanner, SentStateCard } from "@/app/account/_components/AuthUi";
import {
  CASL_SENDER_IDENTITY,
  checkNurtureTokenLookupRateLimit,
  fetchNurtureLeadByToken,
  formatCadAmount,
  isLeadOptedIn,
  vehicleLabelForLead,
} from "@/lib/nurture/consent";

export const dynamic = "force-dynamic";

type OptInPageProps = {
  params: Promise<{ token: string }>;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/50">{label}</dt>
      <dd className="text-[14px] font-semibold leading-relaxed text-white/80 sm:text-right">{value}</dd>
    </div>
  );
}

function InvalidLinkCard() {
  return (
    <ErrorBanner>
      <span>This link is not valid or has expired. </span>
      <Link href="https://jdmrushimports.ca" className="underline underline-offset-4">
        Return home
      </Link>
      <span>.</span>
    </ErrorBanner>
  );
}

export default async function NurtureOptInPage({ params }: OptInPageProps) {
  const { token } = await params;
  const requestHeaders = await headers();
  const allowed = checkNurtureTokenLookupRateLimit("nurture-opt-in-page", requestHeaders);
  const lead = allowed ? await fetchNurtureLeadByToken(token) : null;

  if (!lead) {
    return (
      <AuthPageShell
        title="Get 3 Matches a Week"
        subtitle="Confirm you'd like weekly picks like the one you just quoted."
      >
        <InvalidLinkCard />
      </AuthPageShell>
    );
  }

  const optedIn = isLeadOptedIn(lead);
  const vehicleLabel = vehicleLabelForLead(lead);
  const quotedPrice = formatCadAmount(lead.savedSearch.anchor_card_estimate_cad);

  return (
    <AuthPageShell
      title="Get 3 Matches a Week"
      subtitle="Confirm you'd like weekly picks like the one you just quoted."
    >
      {optedIn ? (
        <SentStateCard
          label="CONFIRMED"
          heading="You're all set"
          body="We'll email you 3 similar Japan Stock matches about once a week. Unsubscribe anytime."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <section className="bg-black border border-white/[0.08] px-5 py-4">
            <dl className="flex flex-col gap-3">
              <DetailRow label="Vehicle" value={vehicleLabel} />
              {lead.savedSearch.anchor_ref ? <DetailRow label="Ref" value={lead.savedSearch.anchor_ref} /> : null}
              {quotedPrice ? <DetailRow label="Est. match price" value={quotedPrice} /> : null}
            </dl>
          </section>
          <p className="text-white/40 text-[12px] leading-relaxed">
            A normalized reference we use to find similarly-priced matches — not the exact landed-cost total from your email above.
          </p>

          <section className="bg-black border border-white/[0.08] px-5 sm:px-6 py-6 flex flex-col gap-4">
            <dl className="flex flex-col gap-3">
              <DetailRow label="Sending to" value={lead.docket.customer_email} />
              <DetailRow label="Frequency" value="3 similar Japan Stock matches, about once a week." />
            </dl>

            <p className="text-white/40 text-[12px] leading-relaxed">{CASL_SENDER_IDENTITY}</p>
            <p className="text-white/50 text-[13px] leading-relaxed">
              Unsubscribe anytime with one click from any email.
            </p>

            <form action={`/api/nurture/opt-in/${encodeURIComponent(token)}`} method="post">
              <button
                type="submit"
                className="w-full min-h-[52px] bg-[#E55125] px-4 py-4 text-[15px] font-bold text-white transition hover:brightness-110 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E55125]"
              >
                Confirm — Send Me Matches
              </button>
            </form>
          </section>

          <p className="text-center text-[12px] leading-relaxed text-white/35">
            {"Not you? No action needed — you won't be signed up."}
          </p>
        </div>
      )}
    </AuthPageShell>
  );
}
