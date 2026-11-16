import crypto from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { isStrictProductionEnvironment } from "@/lib/config/env";
import { deliverPendingRescheduleNotifications } from "@/lib/notifications/rescheduling";
import { cleanupExpiredRateLimitBuckets } from "@/lib/security/rate-limit";
import { logger } from "@/lib/observability/logger";
import { expirePendingBookings } from "@/server/bookings/expiration";
import { expirePendingReschedules } from "@/server/bookings/rescheduling";
import { expirePendingOrders } from "@/server/orders/expiration";

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

  const [result, reschedules, orders, expiredRateLimitBucketCount] = await Promise.all([
    expirePendingBookings(),
    expirePendingReschedules(),
    expirePendingOrders(),
    cleanupExpiredRateLimitBuckets()
  ]);
  const notifications = await deliverPendingRescheduleNotifications();

  logger.info("scheduled-maintenance.completed", {
    expiredBookingCount: result.expiredBookingCount,
    expiredPaymentCount: result.expiredPaymentCount,
    expiredRescheduleCount: reschedules.expiredCount,
    expiredOrderCount: orders.expiredOrderCount,
    expiredRateLimitBucketCount,
    notificationFailedCount: notifications.failedCount
  });

  return NextResponse.json({
    ok: true,
    expiredBookingCount: result.expiredBookingCount,
    expiredPaymentCount: result.expiredPaymentCount,
    expiredRescheduleCount: reschedules.expiredCount,
    expiredOrderCount: orders.expiredOrderCount,
    expiredOrderBookingCount: orders.expiredBookingCount,
    expiredRateLimitBucketCount,
    notificationSentCount: notifications.sentCount,
    notificationFailedCount: notifications.failedCount
  });
}
