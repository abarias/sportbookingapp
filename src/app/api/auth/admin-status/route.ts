import { NextResponse } from "next/server";

import { getCurrentAdminAuthorization } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await getCurrentAdminAuthorization();
  return NextResponse.json({ active: Boolean(authorization) }, { headers: { "Cache-Control": "no-store" } });
}
