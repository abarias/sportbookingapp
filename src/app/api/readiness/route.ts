import crypto from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/observability/logger";
import { isStrictProductionEnvironment } from "@/lib/config/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const readinessTimeoutMilliseconds = 3_000;

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.HEALTHCHECK_SECRET;
  if (!secret && !isStrictProductionEnvironment()) return true;
  const authorization = request.headers.get("authorization");
  return Boolean(secret && authorization && timingSafeEqual(authorization, `Bearer ${secret}`));
}

async function checkDatabase() {
  await Promise.race([
    prisma.$queryRaw`SELECT 1`,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Readiness check timed out.")), readinessTimeoutMilliseconds))
  ]);
}

export async function GET(request: NextRequest) {
  const requestId = request.headers.get("x-vercel-id") ?? crypto.randomUUID();

  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, status: "unauthorized", requestId },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    await checkDatabase();
    return NextResponse.json(
      { ok: true, status: "ready", checks: { database: "ready" }, requestId },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    logger.error("readiness.failed", { requestId, check: "database" });
    return NextResponse.json(
      { ok: false, status: "not_ready", checks: { database: "unavailable" }, requestId },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
