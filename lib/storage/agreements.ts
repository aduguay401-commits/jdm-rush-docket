import { createServerClient } from "@/lib/supabase/server";

export const SIGNED_AGREEMENTS_BUCKET = "signed-agreements";

export async function uploadSignedAgreementPdf({
  docketId,
  pdfBytes,
}: {
  docketId: string;
  pdfBytes: Uint8Array;
}) {
  const supabase = createServerClient();
  const path = `${docketId}/${crypto.randomUUID()}.pdf`;
  const { error } = await supabase.storage
    .from(SIGNED_AGREEMENTS_BUCKET)
    .upload(path, Buffer.from(pdfBytes), {
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) throw new Error(error.message);
  return path;
}

export async function createSignedAgreementUrl(path: string, expiresIn = 300) {
  const supabase = createServerClient();
  const { data, error } = await supabase.storage
    .from(SIGNED_AGREEMENTS_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) throw new Error(error.message);
  return data.signedUrl;
}
