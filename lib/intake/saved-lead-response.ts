/**
 * A receipt for the authenticated website proxy, emitted only AFTER a save.
 * Never use this helper for honeypot/too-fast decoy responses.
 * Unauthenticated callers retain the existing public response shape.
 */
export function savedLeadResponse(request: Request, docketId: string | null): Response {
  const secret = process.env.INTAKE_PROXY_SECRET;
  const authenticatedProxy = Boolean(
    secret &&
    request.headers.get('x-intake-proxy-secret') === secret &&
    request.headers.get('x-intake-client-ip')?.trim()
  );
  const headers = new Headers();
  if (authenticatedProxy && docketId) {
    headers.set('x-jdm-saved-docket-id', docketId);
  }
  return Response.json({ success: true, docketId }, { headers });
}
