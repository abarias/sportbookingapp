import { NotificationDeliveryStatus, Prisma, type PrismaClient } from "@prisma/client";
import { subMinutes } from "date-fns";

import { prisma } from "@/lib/db/prisma";
import { sendBookingLifecycleEmail } from "@/lib/notifications/email";

type NotificationClient = Pick<PrismaClient, "notificationDelivery"> | Prisma.TransactionClient;

export type RescheduleNotificationPayload = {
  subject: string;
  heading: string;
  lines: string[];
};

export async function enqueueRescheduleNotification(client: NotificationClient, input: {
  dedupeKey: string;
  userId: string;
  bookingId: string;
  rescheduleId: string;
  eventType: string;
  payload: RescheduleNotificationPayload;
}) {
  return client.notificationDelivery.upsert({
    where: { dedupeKey: input.dedupeKey },
    update: {},
    create: { ...input, payload: input.payload as unknown as Prisma.InputJsonValue }
  });
}

function parsePayload(value: Prisma.JsonValue): RescheduleNotificationPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.subject !== "string" || typeof candidate.heading !== "string" || !Array.isArray(candidate.lines) || !candidate.lines.every((line) => typeof line === "string")) return null;
  return candidate as RescheduleNotificationPayload;
}

export async function deliverPendingRescheduleNotifications(options: { batchSize?: number } = {}) {
  const batchSize = Math.min(Math.max(options.batchSize ?? 20, 1), 100);
  await prisma.notificationDelivery.updateMany({
    where: { status: NotificationDeliveryStatus.PROCESSING, updatedAt: { lt: subMinutes(new Date(), 10) } },
    data: { status: NotificationDeliveryStatus.FAILED, lastError: "Delivery claim timed out and was released for retry." }
  });
  const candidates = await prisma.notificationDelivery.findMany({
    where: { status: { in: [NotificationDeliveryStatus.PENDING, NotificationDeliveryStatus.FAILED] }, attempts: { lt: 5 } },
    orderBy: { createdAt: "asc" },
    take: batchSize,
    include: { user: { select: { email: true, fullName: true } } }
  });
  let sentCount = 0;
  let failedCount = 0;
  for (const candidate of candidates) {
    const claimed = await prisma.notificationDelivery.updateMany({
      where: { id: candidate.id, status: { in: [NotificationDeliveryStatus.PENDING, NotificationDeliveryStatus.FAILED] } },
      data: { status: NotificationDeliveryStatus.PROCESSING, attempts: { increment: 1 }, lastError: null }
    });
    if (claimed.count !== 1) continue;
    const payload = parsePayload(candidate.payload);
    try {
      if (!payload) throw new Error("Notification payload is invalid.");
      await sendBookingLifecycleEmail({ to: candidate.user.email, fullName: candidate.user.fullName, ...payload });
      await prisma.notificationDelivery.update({ where: { id: candidate.id }, data: { status: NotificationDeliveryStatus.SENT, sentAt: new Date() } });
      sentCount += 1;
    } catch (error) {
      await prisma.notificationDelivery.update({ where: { id: candidate.id }, data: { status: NotificationDeliveryStatus.FAILED, lastError: (error instanceof Error ? error.message : "Notification delivery failed.").slice(0, 500) } });
      failedCount += 1;
    }
  }
  return { sentCount, failedCount };
}
