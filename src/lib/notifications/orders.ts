import { Prisma, type PrismaClient } from "@prisma/client";

import type { RescheduleNotificationPayload } from "@/lib/notifications/rescheduling";

type NotificationClient = Pick<PrismaClient, "notificationDelivery"> | Prisma.TransactionClient;

export async function enqueueOrderNotification(client: NotificationClient, input: {
  dedupeKey: string;
  userId: string;
  bookingOrderId: string;
  eventType: string;
  payload: RescheduleNotificationPayload;
}) {
  return client.notificationDelivery.upsert({
    where: { dedupeKey: input.dedupeKey },
    update: {},
    create: {
      dedupeKey: input.dedupeKey,
      userId: input.userId,
      bookingOrderId: input.bookingOrderId,
      eventType: input.eventType,
      payload: input.payload as unknown as Prisma.InputJsonValue
    }
  });
}
