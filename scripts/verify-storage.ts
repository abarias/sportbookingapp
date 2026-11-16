import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const paymentBucket = process.env.SUPABASE_PAYMENT_PROOFS_BUCKET ?? "payment-proofs";
  const facilityBucket = process.env.SUPABASE_FACILITY_IMAGES_BUCKET ?? "facility-images";

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data: buckets, error } = await client.storage.listBuckets();

  if (error) {
    throw new Error(`Could not list Supabase Storage buckets: ${error.message}`);
  }

  const expected = [
    { name: paymentBucket, isPublic: false, purpose: "private payment proofs" },
    { name: facilityBucket, isPublic: true, purpose: "public facility images" }
  ];
  const failures: string[] = [];

  for (const bucket of expected) {
    const actual = buckets.find((candidate) => candidate.name === bucket.name);

    if (!actual) {
      failures.push(`Missing ${bucket.purpose} bucket: ${bucket.name}`);
      continue;
    }

    if (actual.public !== bucket.isPublic) {
      failures.push(`${bucket.name} must be ${bucket.isPublic ? "public" : "private"}.`);
      continue;
    }

    console.log(`PASS ${bucket.name}: present and ${bucket.isPublic ? "public" : "private"}`);
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exitCode = 1;
  } else {
    console.log("Storage bucket visibility matches the application requirements.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Storage validation failed.");
  process.exitCode = 1;
});
