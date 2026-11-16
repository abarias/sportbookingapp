import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAndNormalizeImage } from "@/lib/storage/validated-image";

const DEFAULT_BUCKET = "payment-proofs";
const SIGNED_URL_SECONDS = 60 * 60;

function getStorageConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_PAYMENT_PROOFS_BUCKET ?? DEFAULT_BUCKET;

  return url && serviceRoleKey ? { url, serviceRoleKey, bucket } : null;
}

export async function storePaymentProof(file: File, referenceId: string, ownerType: "bookings" | "orders" = "bookings") {
  const config = getStorageConfig();
  const image = await validateAndNormalizeImage(file);
  const fileName = `${referenceId}-${Date.now()}-${crypto.randomUUID()}${image.extension}`;

  if (config) {
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const objectPath = `${ownerType}/${referenceId}/${fileName}`;
    const { error } = await client.storage.from(config.bucket).upload(objectPath, image.bytes, {
      contentType: image.contentType,
      upsert: false
    });

    if (error) {
      throw new Error(`Payment proof could not be stored: ${error.message}`);
    }

    return `supabase-storage://${config.bucket}/${objectPath}`;
  }

  if (process.env.VERCEL) {
    throw new Error("Payment proof storage is not configured for Vercel. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "payment-proofs");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), image.bytes);

  return `/uploads/payment-proofs/${fileName}`;
}

export async function getPaymentProofUrl(value: string | null) {
  if (!value || !value.startsWith("supabase-storage://")) {
    return value;
  }

  const config = getStorageConfig();

  if (!config) {
    throw new Error("Payment proof storage is not configured.");
  }

  const storagePath = value.slice("supabase-storage://".length);
  const separatorIndex = storagePath.indexOf("/");
  const bucket = storagePath.slice(0, separatorIndex);
  const objectPath = storagePath.slice(separatorIndex + 1);
  const client = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await client.storage.from(bucket).createSignedUrl(objectPath, SIGNED_URL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(`Payment proof could not be accessed: ${error?.message ?? "signed URL was not returned"}`);
  }

  return data.signedUrl;
}
