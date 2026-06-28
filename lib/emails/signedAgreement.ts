const LOGO_URL = "https://scfezjqjbzqbtfsveedl.supabase.co/storage/v1/object/public/docket-files/Assets/JDMRUSH_Imports_RGB_Colour-white_png.png";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildSignedAgreementEmail({
  firstName,
  vehicle,
  devMode,
  originalRecipient,
}: {
  firstName: string;
  vehicle: string;
  devMode: boolean;
  originalRecipient: string;
}) {
  const safeFirstName = escapeHtml(firstName || "there");
  const safeVehicle = escapeHtml(vehicle || "your vehicle");
  const devBanner = devMode
    ? `<div style="margin:0 0 16px;padding:12px;border:1px solid #E55125;border-radius:8px;background:#2a130a;color:#f8d1c5;font-size:13px;">[DEV MODE] This email would normally go to ${escapeHtml(originalRecipient)}</div>`
    : "";

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#0d0d0d;color:#ffffff;font-family:Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0d0d0d;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;background:#111111;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:20px 24px;border-bottom:1px solid #2a2a2a;">
                <img src="${LOGO_URL}" alt="JDM Rush Imports" style="height:50px;margin-bottom:24px;display:block;" />
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                ${devBanner}
                <h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;color:#ffffff;">Agreement signed</h1>
                <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#efefef;">Hi ${safeFirstName},</p>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#d6d6d6;">Your purchase agreement for ${safeVehicle} is complete. A copy of the signed PDF is attached for your records.</p>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#d0d0d0;">We have securely stored the agreement and driver license document in your private JDM Rush docket vault.</p>
                <p style="margin:0;color:#E55125;font-size:14px;line-height:1.6;">Adam &amp; the JDM Rush Team<br />support@jdmrushimports.ca</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textDevPrefix = devMode ? `[DEV MODE] This email would normally go to ${originalRecipient}\n\n` : "";
  const text = `${textDevPrefix}Hi ${firstName || "there"},\n\nYour purchase agreement for ${vehicle || "your vehicle"} is complete. A copy of the signed PDF is attached for your records.\n\nWe have securely stored the agreement and driver license document in your private JDM Rush docket vault.\n\nAdam & the JDM Rush Team\nsupport@jdmrushimports.ca`;

  return { html, text };
}
