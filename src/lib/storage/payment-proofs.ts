import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_BUCKET = "payment-proofs";
const SIGNED_URL_SECONDS = 60 * 60;

function getStorageConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_PAYMENT_PROOFS_BUCKET ?? DEFAULT_BUCKET;

  return url && serviceRoleKey ? { url, serviceRoleKey, bucket } : null;
}

function getImageExtension(file: File) {
  const extensions: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif"
  };

  return extensions[file.type] ?? ".jpg";
}

export async function storePaymentProof(file: File, bookingId: string) {
  const config = getStorageConfig();
  const extension = getImageExtension(file);
  const fileName = `${bookingId}-${Date.now()}-${crypto.randomUUID()}${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  if (config) {
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const objectPath = `bookings/${bookingId}/${fileName}`;
    const { error } = await client.storage.from(config.bucket).upload(objectPath, bytes, {
      contentType: file.type,
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
  await writeFile(path.join(uploadDir, fileName), bytes);

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
