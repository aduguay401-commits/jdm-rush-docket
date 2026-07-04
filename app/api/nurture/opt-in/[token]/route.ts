import { NextResponse } from "next/server";

import {
  checkNurtureTokenLookupRateLimit,
  getConsentRequestMeta,
  recordLeadOptIn,
} from "@/lib/nurture/consent";

export const dynamic = "force-dynamic";

type OptInRouteContext = {
  params: Promise<{ token: string }>;
};

function redirectToPage(request: Request, token: string) {
  return NextResponse.redirect(new URL(`/nurture/opt-in/${encodeURIComponent(token)}`, request.url), 303);
}

export async function POST(request: Request, context: OptInRouteContext) {
  const { token } = await context.params;
  const allowed = checkNurtureTokenLookupRateLimit("nurture-opt-in-post", request.headers);

  if (allowed) {
    await recordLeadOptIn(token, getConsentRequestMeta(request.headers));
  }

  return redirectToPage(request, token);
}
