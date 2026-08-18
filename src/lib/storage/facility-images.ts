import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_BUCKET = "facility-images";
function getStorageConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_FACILITY_IMAGES_BUCKET ?? DEFAULT_BUCKET;

  return url && serviceRoleKey ? { url, serviceRoleKey, bucket } : null;
}

const extensions: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif"
};

export async function storeFacilityImages(files: File[], facilityKey: string) {
  const config = getStorageConfig();
  const safeKey = facilityKey.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "facility";
  const urls: string[] = [];

  for (const [index, file] of files.entries()) {
    const extension = extensions[file.type] ?? ".jpg";
    const fileName = `${safeKey}-${Date.now()}-${index}-${crypto.randomUUID()}${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    if (config) {
      const client = createClient(config.url, config.serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      const objectPath = `facilities/${safeKey}/${fileName}`;
      const { error } = await client.storage.from(config.bucket).upload(objectPath, bytes, {
        contentType: file.type,
        upsert: false
      });

      if (error) {
        throw new Error(`Facility image could not be stored: ${error.message}`);
      }

      const { data } = client.storage.from(config.bucket).getPublicUrl(objectPath);
      urls.push(data.publicUrl);
      continue;
    }

    if (process.env.VERCEL) {
      throw new Error("Facility image storage is not configured for Vercel. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "facilities");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, fileName), bytes);
    urls.push(`/uploads/facilities/${fileName}`);
  }

  return urls;
}
