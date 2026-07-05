import { getAppBaseUrl } from "@/lib/urls";

type AccountRegisterLinkInput = {
  email?: string | null;
  nextPath?: string | null;
};

type AccountUpsellEmailInput = {
  registerUrl: string;
};

type AccountUpsellPanelProps = {
  registerUrl: string;
};

const ACCOUNT_UPSELL_HEADING = "Create your My Garage account";
const ACCOUNT_UPSELL_BODY = "Track this build, your imports, and your documents in one place.";

function cleanString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildAccountRegisterPath({ email, nextPath }: AccountRegisterLinkInput = {}) {
  const params = new URLSearchParams();
  const normalizedEmail = cleanString(email)?.toLowerCase();
  const normalizedNext = cleanString(nextPath);

  if (normalizedEmail) {
    params.set("email", normalizedEmail);
  }

  if (normalizedNext) {
    params.set("next", normalizedNext);
  }

  const queryString = params.toString();
  return queryString ? `/account/register?${queryString}` : "/account/register";
}

export function buildAccountRegisterUrl(input: AccountRegisterLinkInput = {}) {
  return `${getAppBaseUrl()}${buildAccountRegisterPath(input)}`;
}

export function renderAccountUpsellEmailFooter({ registerUrl }: AccountUpsellEmailInput) {
  const safeRegisterUrl = escapeHtml(registerUrl);

  return `<div style="border-top:1px solid #2a2a2a;margin:28px 0 0 0;padding:20px 0 0 0;">
    <p style="color:#cccccc;font-size:13px;line-height:1.7;margin:0 0 6px 0;">
      Want everything organized in one place?
      <a href="${safeRegisterUrl}" target="_blank" style="color:#E55125;text-decoration:none;font-weight:700;">${ACCOUNT_UPSELL_HEADING}</a>.
    </p>
    <p style="color:#888888;font-size:12px;line-height:1.6;margin:0;">${ACCOUNT_UPSELL_BODY}</p>
  </div>`;
}

export function renderAccountUpsellEmailTextFooter({ registerUrl }: AccountUpsellEmailInput) {
  return `Want everything organized in one place? ${ACCOUNT_UPSELL_HEADING}: ${registerUrl}
${ACCOUNT_UPSELL_BODY}`;
}

export function renderAccountUpsellEmailPanel({ registerUrl }: AccountUpsellEmailInput) {
  const safeRegisterUrl = escapeHtml(registerUrl);

  return `<div style="background:#151515;border:1px solid #2a2a2a;padding:20px;margin:24px 0 0 0;">
    <p style="font-size:13px;color:#E55125;font-weight:700;letter-spacing:0.08em;margin:0 0 8px 0;">MY GARAGE</p>
    <p style="color:#ffffff;font-size:18px;font-weight:700;line-height:1.4;margin:0 0 8px 0;">${ACCOUNT_UPSELL_HEADING}</p>
    <p style="color:#cccccc;font-size:14px;line-height:1.7;margin:0 0 16px 0;">${ACCOUNT_UPSELL_BODY}</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="border-collapse:separate;margin:0 auto;width:100%;">
      <tr>
        <td align="center" bgcolor="#E55125" style="background-color:#E55125;padding:15px 20px;">
          <a href="${safeRegisterUrl}" target="_blank" style="display:inline-block;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;line-height:1.3;">${ACCOUNT_UPSELL_HEADING}</a>
        </td>
      </tr>
    </table>
  </div>`;
}

export function AccountUpsellPanel({ registerUrl }: AccountUpsellPanelProps) {
  return (
    <section className="border border-white/[0.08] bg-black px-5 py-6 sm:px-6">
      <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#E55125]">My Garage</p>
      <h2 className="mt-3 text-[22px] font-bold leading-tight text-white">{ACCOUNT_UPSELL_HEADING}</h2>
      <p className="mt-3 text-[14px] leading-6 text-white/65">{ACCOUNT_UPSELL_BODY}</p>
      <a
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center bg-[#E55125] px-5 py-3 text-[14px] font-bold text-white transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E55125]"
        href={registerUrl}
      >
        Create Account
      </a>
    </section>
  );
}
