import { headers } from "next/headers";

import { signAgreementPdf } from "@/lib/agreements/sign";
import { fillAgreementTemplate } from "@/lib/agreements/fillTemplate";
import { pickTemplate } from "@/lib/agreements/templates";
import { getLicenseExtension, uploadLicenseDocument } from "@/lib/storage/licenses";
import { uploadSignedAgreementPdf } from "@/lib/storage/agreements";
import { buildSignedAgreementEmail } from "@/lib/emails/signedAgreement";
import { sendEmail } from "@/lib/email";
import { createServerClient } from "@/lib/supabase/server";
import { createServerAuthClient } from "@/lib/supabase/server-auth";

export const runtime = "nodejs";

type SigningDocket = {
  id: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_description: string | null;
  selected_path: string | null;
  chosen_path?: string | null;
  agreement_signed: boolean | null;
};

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function buildAddress(formData: FormData) {
  const street = formString(formData, "street");
  const city = formString(formData, "city");
  const province = formString(formData, "province");
  const postalCode = formString(formData, "postalCode");
  return {
    street,
    city,
    province,
    postalCode,
    full: [street, [city, province].filter(Boolean).join(", "), postalCode].filter(Boolean).join(" "),
  };
}

function buildVehicle(docket: SigningDocket) {
  return [docket.vehicle_year, docket.vehicle_make, docket.vehicle_model]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ") || docket.vehicle_description || "your vehicle";
}

function getClientIp(headersList: Headers) {
  return headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || headersList.get("x-real-ip") || null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const authSupabase = await createServerAuthClient();
  const { data: auth } = await authSupabase.auth.getUser();

  if (!auth.user) {
    return Response.json({ success: false, error: "Login required" }, { status: 401 });
  }

  const { data: docket, error: docketError } = await authSupabase
    .from("dockets")
    .select("id, customer_first_name, customer_last_name, customer_email, customer_phone, vehicle_year, vehicle_make, vehicle_model, vehicle_description, selected_path, chosen_path, agreement_signed")
    .eq("id", id)
    .maybeSingle<SigningDocket>();

  if (docketError) {
    return Response.json({ success: false, error: docketError.message }, { status: 500 });
  }

  if (!docket) {
    return Response.json({ success: false, error: "Not authorized for this docket" }, { status: 403 });
  }

  if (docket.agreement_signed) {
    return Response.json({ success: false, error: "Agreement is already signed" }, { status: 409 });
  }

  const formData = await request.formData();
  const signedByName = formString(formData, "signedByName");
  const signedDate = formString(formData, "signedDate");
  const signatureDataUrl = formString(formData, "signatureDataUrl");
  const address = buildAddress(formData);
  const license = formData.get("license");

  if (!address.street || !address.city || !address.province || !address.postalCode) {
    return Response.json({ success: false, error: "Complete address is required" }, { status: 400 });
  }

  if (!signedByName || !signedDate || !signatureDataUrl) {
    return Response.json({ success: false, error: "Signature, legal name, and date are required" }, { status: 400 });
  }

  if (!(license instanceof File) || !getLicenseExtension(license.type)) {
    return Response.json({ success: false, error: "A JPG, PNG, HEIC, WEBP, or PDF driver license is required" }, { status: 400 });
  }

  const headersList = await headers();
  const customerEmail = auth.user.email ?? docket.customer_email ?? "unknown@email.com";
  const template = pickTemplate(docket);
  const filledAgreementMarkdown = fillAgreementTemplate(template.body, docket, { customer_address: address.full });
  const signedAt = new Date().toISOString();
  const ipAddress = getClientIp(headersList);
  const userAgent = headersList.get("user-agent");
  const { pdfBytes, sha256 } = await signAgreementPdf({
    filledAgreementMarkdown,
    signatureDataUrl,
    signedByName,
    signedByEmail: customerEmail,
    customerAddress: address.full,
    docketId: docket.id,
    agreementType: template.type,
    signedAt,
    ipAddress,
    userAgent,
  });

  const licensePath = await uploadLicenseDocument({ docketId: docket.id, file: license });
  const pdfPath = await uploadSignedAgreementPdf({ docketId: docket.id, pdfBytes });
  const serviceSupabase = createServerClient();

  const { error: insertError } = await serviceSupabase.from("agreement_signatures").insert({
    docket_id: docket.id,
    agreement_type: template.type,
    signed_by_name: signedByName,
    signed_by_email: customerEmail,
    customer_address: address.full,
    signed_at: signedAt,
    ip_address: ipAddress,
    user_agent: userAgent,
    signature_image_path: null,
    pdf_path: pdfPath,
    pdf_hash: sha256,
    license_path: licensePath,
    metadata: {
      signed_date: signedDate,
      vehicle: buildVehicle(docket),
      template_label: template.label,
    },
  });

  if (insertError) {
    return Response.json({ success: false, error: insertError.message }, { status: 500 });
  }

  const { error: updateError } = await serviceSupabase
    .from("dockets")
    .update({ agreement_signed: true })
    .eq("id", docket.id);

  if (updateError) {
    return Response.json({ success: false, error: updateError.message }, { status: 500 });
  }

  const fromEmail = process.env.FROM_EMAIL;
  const adminEmail = process.env.ADMIN_EMAIL ?? "adam@jdmrushimports.ca";
  const devMode = process.env.DEV_MODE === "true";

  if (!fromEmail) {
    return Response.json({ success: false, error: "Email configuration is missing" }, { status: 500 });
  }

  const recipientEmail = devMode ? adminEmail : customerEmail;
  const firstName = docket.customer_first_name?.trim() || signedByName.split(/\s+/)[0] || "there";
  const vehicle = buildVehicle(docket);
  const email = buildSignedAgreementEmail({
    firstName,
    vehicle,
    devMode,
    originalRecipient: customerEmail,
  });

  const sendResult = await sendEmail({
    from: fromEmail,
    to: recipientEmail,
    subject: `Signed purchase agreement for ${vehicle}`,
    html: email.html,
    text: email.text,
    attachments: [
      {
        filename: `JDM-Rush-Purchase-Agreement-${docket.id}.pdf`,
        content: Buffer.from(pdfBytes),
        contentType: "application/pdf",
      },
    ],
  });

  if (sendResult.error) {
    return Response.json({ success: false, error: "Agreement signed, but email failed to send" }, { status: 500 });
  }

  await serviceSupabase.from("email_log").insert({
    docket_id: docket.id,
    email_type: "email_6_signed_agreement",
    recipient_email: recipientEmail,
    subject: `Signed purchase agreement for ${vehicle}`,
    body_snapshot: email.html,
  });

  return Response.json({ success: true, pdfHash: sha256 });
}
