import crypto from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { renderAgreementPdf } from "@/lib/agreements/renderPdf";

export type SignAgreementInput = {
  filledAgreementMarkdown: string;
  signatureDataUrl: string;
  signedByName: string;
  signedByEmail: string;
  customerAddress: string;
  docketId: string;
  agreementType: string;
  signedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
};

function decodeSignatureDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error("Signature image must be a PNG or JPEG data URL");
  }

  return {
    mime: match[1],
    bytes: Buffer.from(match[2], "base64"),
  };
}

export async function signAgreementPdf(input: SignAgreementInput): Promise<{ pdfBytes: Uint8Array; sha256: string }> {
  const basePdf = await renderAgreementPdf(input.filledAgreementMarkdown);
  const pdf = await PDFDocument.load(basePdf);
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const signature = decodeSignatureDataUrl(input.signatureDataUrl);
  const signatureImage = signature.mime === "png"
    ? await pdf.embedPng(signature.bytes)
    : await pdf.embedJpg(signature.bytes);
  const signatureDims = signatureImage.scaleToFit(260, 96);

  page.drawText("Digital Signature and Audit Stamp", {
    x: 54,
    y: 720,
    size: 18,
    font: boldFont,
    color: rgb(0.08, 0.08, 0.08),
  });
  page.drawText("The customer completed this agreement through the authenticated My JDM Garage portal.", {
    x: 54,
    y: 696,
    size: 10,
    font,
    color: rgb(0.24, 0.24, 0.24),
  });
  page.drawRectangle({
    x: 54,
    y: 520,
    width: 300,
    height: 120,
    borderColor: rgb(0.898, 0.318, 0.145),
    borderWidth: 1,
    color: rgb(0.985, 0.985, 0.985),
  });
  page.drawImage(signatureImage, {
    x: 74,
    y: 548,
    width: signatureDims.width,
    height: signatureDims.height,
  });
  page.drawLine({
    start: { x: 74, y: 540 },
    end: { x: 334, y: 540 },
    thickness: 0.8,
    color: rgb(0.898, 0.318, 0.145),
  });
  page.drawText("Client Signature", { x: 74, y: 526, size: 8, font, color: rgb(0.36, 0.36, 0.36) });

  const auditRows = [
    ["Signed by", input.signedByName],
    ["Email", input.signedByEmail],
    ["Agreement", input.agreementType],
    ["Docket", input.docketId],
    ["Address", input.customerAddress],
    ["Signed at", input.signedAt],
    ["IP address", input.ipAddress ?? "Unavailable"],
    ["User agent", input.userAgent ?? "Unavailable"],
    ["PDF hash", "SHA-256 saved in agreement_signatures.pdf_hash"],
  ];

  let y = 474;
  for (const [label, value] of auditRows) {
    page.drawText(`${label}:`, { x: 54, y, size: 9.5, font: boldFont, color: rgb(0.08, 0.08, 0.08) });
    page.drawText(String(value).slice(0, 96), { x: 142, y, size: 9.5, font, color: rgb(0.16, 0.16, 0.16) });
    y -= 18;
  }

  const pdfBytes = await pdf.save();
  const sha256 = crypto.createHash("sha256").update(pdfBytes).digest("hex");

  return { pdfBytes, sha256 };
}
