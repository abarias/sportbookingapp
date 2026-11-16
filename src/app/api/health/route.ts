import crypto from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = request.headers.get("x-vercel-id") ?? crypto.randomUUID();
  return NextResponse.json(
    { ok: true, status: "healthy", requestId },
    { headers: { "Cache-Control": "no-store" } }
  );
}
