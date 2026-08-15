import crypto from "node:crypto";

import { headers } from "next/headers";

function firstForwardedIp(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

export async function getRequestIpHash() {
  const requestHeaders = await headers();
  const ip =
    firstForwardedIp(requestHeaders.get("x-forwarded-for")) ??
    requestHeaders.get("x-real-ip") ??
    "unknown";
  const pepper = process.env.NEXTAUTH_SECRET ?? "development-secret";

  return crypto.createHash("sha256").update(`${pepper}:${ip}`).digest("hex");
}
