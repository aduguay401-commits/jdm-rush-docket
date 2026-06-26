import { getAppBaseUrl } from "@/lib/urls";

export const DEFAULT_CUSTOMER_NEXT_PATH = "/account";

export function normalizeCustomerNextPath(value: unknown) {
  if (typeof value !== "string") {
    return DEFAULT_CUSTOMER_NEXT_PATH;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_CUSTOMER_NEXT_PATH;
  }

  try {
    const baseUrl = new URL(getAppBaseUrl());
    const resolvedUrl = new URL(trimmed, baseUrl);

    if (resolvedUrl.origin !== baseUrl.origin) {
      return DEFAULT_CUSTOMER_NEXT_PATH;
    }

    return `${resolvedUrl.pathname}${resolvedUrl.search}`;
  } catch {
    return DEFAULT_CUSTOMER_NEXT_PATH;
  }
}

export function getCustomerAuthCallbackUrl(nextPath = DEFAULT_CUSTOMER_NEXT_PATH) {
  const callbackUrl = new URL("/auth/customer/callback", getAppBaseUrl());
  callbackUrl.searchParams.set("next", normalizeCustomerNextPath(nextPath));
  return callbackUrl.toString();
}
