import { headers } from "next/headers";
import Link from "next/link";

import { AuthPageShell } from "@/app/account/_components/AuthPageShell";
import { ErrorBanner } from "@/app/account/_components/AuthUi";
import {
  checkNurtureTokenLookupRateLimit,
  getConsentRequestMeta,
  recordLeadUnsubscribe,
} from "@/lib/nurture/consent";

export const dynamic = "force-dynamic";

type UnsubscribePageProps = {
  params: Promise<{ token: string }>;
};

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

export default async function NurtureUnsubscribePage({ params }: UnsubscribePageProps) {
  const { token } = await params;
  const requestHeaders = await headers();
  const allowed = checkNurtureTokenLookupRateLimit("nurture-unsubscribe-page", requestHeaders);
  const lead = allowed ? await recordLeadUnsubscribe(token, getConsentRequestMeta(requestHeaders)) : null;

  return (
    <AuthPageShell title="Unsubscribed" subtitle="Weekly Japan Stock matches are now turned off.">
      {!lead ? (
        <InvalidLinkCard />
      ) : (
        <section className="bg-black border border-white/[0.08] px-5 sm:px-6 py-6 flex flex-col gap-4">
          <div>
            <p className="text-white text-[20px] font-extrabold tracking-tight leading-snug">
              {"You won't receive weekly matches anymore."}
            </p>
            <p className="text-white/60 text-[13px] leading-relaxed mt-2">
              {"We've removed "}{lead.docket.customer_email}{" from the weekly matches list. You'll still get transactional emails about your own quote."}
            </p>
          </div>
        </section>
      )}
    </AuthPageShell>
  );
}
