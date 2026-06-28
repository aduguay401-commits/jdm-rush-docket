import { createServerClient } from "@/lib/supabase/server";

export const CUSTOMER_DOCUMENTS_BUCKET = "customer-documents";
export const MAX_LICENSE_BYTES = 10 * 1024 * 1024;

const LICENSE_MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heic",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function getLicenseExtension(mimeType: string) {
  return LICENSE_MIME_EXTENSIONS[mimeType] ?? null;
}

export async function uploadLicenseDocument({
  docketId,
  file,
}: {
  docketId: string;
  file: File;
}) {
  const extension = getLicenseExtension(file.type);

  if (!extension) {
    throw new Error("Driver license must be a JPG, PNG, HEIC, WEBP, or PDF file");
  }

  if (file.size <= 0 || file.size > MAX_LICENSE_BYTES) {
    throw new Error("Driver license must be smaller than 10 MB");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `${docketId}/${crypto.randomUUID()}.${extension}`;
  const supabase = createServerClient();
  const { error } = await supabase.storage
    .from(CUSTOMER_DOCUMENTS_BUCKET)
    .upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw new Error(error.message);
  return path;
}

export async function createLicenseSignedUrl(path: string, expiresIn = 300) {
  const supabase = createServerClient();
  const { data, error } = await supabase.storage
    .from(CUSTOMER_DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function logDocumentAccess({
  documentPath,
  accessedBy,
  docketId,
  ipAddress,
}: {
  documentPath: string;
  accessedBy: string;
  docketId: string;
  ipAddress: string | null;
}) {
  const supabase = createServerClient();
  const { error } = await supabase.from("document_access_log").insert({
    document_path: documentPath,
    accessed_by: accessedBy,
    docket_id: docketId,
    ip_address: ipAddress,
  });

  if (error) throw new Error(error.message);
}
