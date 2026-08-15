import crypto from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { isStrictProductionEnvironment } from "@/lib/config/env";
import { expirePendingBookings } from "@/server/bookings/expiration";

export const runtime = "nodejs";

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isAuthorizedCronRequest(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret && !isStrictProductionEnvironment()) {
    return true;
  }

  if (!cronSecret) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  const expected = `Bearer ${cronSecret}`;

  return Boolean(authorization && timingSafeEqual(authorization, expected));
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await expirePendingBookings();

  return NextResponse.json({
    ok: true,
    expiredBookingCount: result.expiredBookingCount,
    expiredPaymentCount: result.expiredPaymentCount
  });
}
