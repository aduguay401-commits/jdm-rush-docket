import { headers } from "next/headers";

import { signAgreementPdf } from "@/lib/agreements/sign";
import { fillAgreementTemplate } from "@/lib/agreements/fillTemplate";
import { pickTemplate } from "@/lib/agreements/templates";
import { MAX_LICENSE_BYTES, getLicenseExtension, uploadLicenseDocument, uploadSignatureImage } from "@/lib/storage/licenses";
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

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

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
    return jsonError("Login required", 401);
  }

  const { data: docket, error: docketError } = await authSupabase
    .from("dockets")
    .select("id, customer_first_name, customer_last_name, customer_email, customer_phone, vehicle_year, vehicle_make, vehicle_model, vehicle_description, selected_path, chosen_path, agreement_signed")
    .eq("id", id)
    .maybeSingle<SigningDocket>();

  if (docketError) {
    return jsonError(docketError.message, 500);
  }

  if (!docket) {
    return jsonError("Not authorized for this docket", 403);
  }

  if (docket.agreement_signed) {
    return jsonError("Agreement is already signed", 409);
  }

  const chosenPath = docket.chosen_path ?? docket.selected_path;
  if (!chosenPath) {
    return jsonError("A purchase path must be selected before this agreement can be signed", 400);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Unable to read signing form data", 400);
  }

  const signedByName = formString(formData, "signedByName");
  const signedDate = formString(formData, "signedDate");
  const signatureDataUrl = formString(formData, "signatureDataUrl");
  const address = buildAddress(formData);
  const license = formData.get("license");

  if (!address.street || !address.city || !address.province || !address.postalCode) {
    return jsonError("Complete address is required", 400);
  }

  if (!signedByName || !signedDate || !signatureDataUrl) {
    return jsonError("Signature, legal name, and date are required", 400);
  }

  if (!signatureDataUrl.startsWith("data:image/png;base64,")) {
    return jsonError("Signature image must be a PNG", 400);
  }

  if (!(license instanceof File) || !getLicenseExtension(license.type)) {
    return jsonError("A JPG, PNG, HEIC, WEBP, or PDF driver license is required", 400);
  }

  if (license.size <= 0) {
    return jsonError("Driver license file is empty", 400);
  }

  if (license.size > MAX_LICENSE_BYTES) {
    return jsonError("Driver license must be 10 MB or smaller", 413);
  }

  const headersList = await headers();
  const customerEmail = auth.user.email ?? docket.customer_email ?? "unknown@email.com";
  const template = pickTemplate(docket);
  const filledAgreementMarkdown = fillAgreementTemplate(template.body, docket, { customer_address: address.full });
  const signedAt = new Date().toISOString();
  const ipAddress = getClientIp(headersList);
  const userAgent = headersList.get("user-agent");

  let signedPdf: { pdfBytes: Uint8Array; sha256: string };
  try {
    signedPdf = await signAgreementPdf({
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
  } catch {
    return jsonError("Unable to generate the signed agreement PDF", 500);
  }

  let licensePath: string;
  let signatureImagePath: string;
  let pdfPath: string;
  try {
    licensePath = await uploadLicenseDocument({ docketId: docket.id, file: license });
    signatureImagePath = await uploadSignatureImage({ docketId: docket.id, signatureDataUrl });
    pdfPath = await uploadSignedAgreementPdf({ docketId: docket.id, pdfBytes: signedPdf.pdfBytes });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "Unable to securely store agreement documents";
    return jsonError(message, 500);
  }

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
    signature_image_path: signatureImagePath,
    pdf_path: pdfPath,
    pdf_hash: signedPdf.sha256,
    license_path: licensePath,
    metadata: {
      signed_date: signedDate,
      vehicle: buildVehicle(docket),
      template_label: template.label,
    },
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return jsonError("Agreement is already signed", 409);
    }
    return jsonError(insertError.message, 500);
  }

  const { error: updateError } = await serviceSupabase
    .from("dockets")
    .update({ agreement_signed: true })
    .eq("id", docket.id);

  if (updateError) {
    return jsonError(updateError.message, 500);
  }

  const fromEmail = process.env.FROM_EMAIL;
  const adminEmail = process.env.ADMIN_EMAIL ?? "adam@jdmrushimports.ca";
  const devMode = process.env.DEV_MODE === "true";

  if (!fromEmail) {
    return jsonError("Email configuration is missing", 500);
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
    subject: "Signed purchase agreement for " + vehicle,
    html: email.html,
    text: email.text,
    attachments: [
      {
        filename: "JDM-Rush-Purchase-Agreement-" + docket.id + ".pdf",
        content: Buffer.from(signedPdf.pdfBytes),
        contentType: "application/pdf",
      },
    ],
  });

  if (sendResult.error) {
    return jsonError("Agreement signed, but email failed to send", 500);
  }

  await serviceSupabase.from("email_log").insert({
    docket_id: docket.id,
    email_type: "email_6_signed_agreement",
    recipient_email: recipientEmail,
    subject: "Signed purchase agreement for " + vehicle,
    body_snapshot: email.html,
  });

  return Response.json({ success: true, pdfHash: signedPdf.sha256 });
}
