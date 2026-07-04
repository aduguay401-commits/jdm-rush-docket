import { NextResponse } from "next/server";

import {
  checkNurtureTokenLookupRateLimit,
  getConsentRequestMeta,
  recordLeadUnsubscribe,
} from "@/lib/nurture/consent";

export const dynamic = "force-dynamic";

type UnsubscribeRouteContext = {
  params: Promise<{ token: string }>;
};

function redirectToPage(request: Request, token: string) {
  return NextResponse.redirect(new URL(`/nurture/unsubscribe/${encodeURIComponent(token)}`, request.url), 303);
}

export async function GET(request: Request, context: UnsubscribeRouteContext) {
  const { token } = await context.params;
  const allowed = checkNurtureTokenLookupRateLimit("nurture-unsubscribe-get", request.headers);

  if (allowed) {
    await recordLeadUnsubscribe(token, getConsentRequestMeta(request.headers));
  }

  return redirectToPage(request, token);
}

export async function POST(request: Request, context: UnsubscribeRouteContext) {
  const { token } = await context.params;
  const allowed = checkNurtureTokenLookupRateLimit("nurture-unsubscribe-post", request.headers);

  if (allowed) {
    await recordLeadUnsubscribe(token, getConsentRequestMeta(request.headers));
  }

  return new NextResponse(null, { status: 204 });
}
