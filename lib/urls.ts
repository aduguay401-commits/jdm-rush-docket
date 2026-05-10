const DEFAULT_APP_URL = "https://docket.jdmrushimports.ca";

export function getAppBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL).replace(/\/+$/, "");
}

export function getCustomerHomeBaseUrl(token: string): string {
  return `${getAppBaseUrl()}/questions/${encodeURIComponent(token)}`;
}

export function getCustomerReportUrl(token: string): string {
  return `${getAppBaseUrl()}/report/${encodeURIComponent(token)}`;
}
