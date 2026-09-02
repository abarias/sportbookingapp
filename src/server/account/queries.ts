import { BookingRescheduleStatus, PaymentStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type AccountInboxItem = {
  id: string;
  title: string;
  message: string;
  createdAt: Date;
  href: string | null;
  actionLabel: string | null;
  isActionRequired: boolean;
};

const ACTIONABLE_NOTIFICATION_EVENTS = [
  "BOOKING_ORDER_PAYMENT_REQUESTED",
  "BOOKING_ORDER_PAYMENT_ACTION_REQUIRED",
  "RESCHEDULE_ADDITIONAL_PAYMENT_REQUESTED"
];

function payloadText(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { heading: "Account update", message: "There is an update on one of your bookings." };
  const data = payload as { heading?: unknown; lines?: unknown };
  return {
    heading: typeof data.heading === "string" ? data.heading : "Account update",
    message: Array.isArray(data.lines) ? data.lines.filter((line): line is string => typeof line === "string").join(" ") : "There is an update on one of your bookings."
  };
}

export async function getAccountProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true, email: true, phone: true, emailVerifiedAt: true, phoneVerifiedAt: true, createdAt: true }
  });
}

export async function getCustomerAccountNotificationState(userId: string) {
  const [user, notification, booking, reschedule] = await prisma.$transaction([
    prisma.user.findUnique({ where: { id: userId }, select: { accountInboxViewedAt: true } }),
    prisma.notificationDelivery.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.booking.findFirst({ where: { userId, payment: { status: { in: [PaymentStatus.AWAITING_PAYMENT, PaymentStatus.ACTION_REQUIRED] } } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.bookingReschedule.findFirst({ where: { booking: { userId }, status: BookingRescheduleStatus.ADDITIONAL_PAYMENT_REQUIRED }, orderBy: { createdAt: "desc" }, select: { createdAt: true } })
  ]);
  const latestCreatedAt = [notification?.createdAt, booking?.createdAt, reschedule?.createdAt].filter((date): date is Date => Boolean(date)).sort((left, right) => right.getTime() - left.getTime())[0];
  return Boolean(latestCreatedAt && (!user?.accountInboxViewedAt || latestCreatedAt > user.accountInboxViewedAt));
}

export async function getCustomerAccountData(userId: string, options: { page: number; pageSize: number; search?: string }) {
  const [user, notifications, actionBookings, actionReschedules] = await prisma.$transaction([
    prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, email: true, phone: true, emailVerifiedAt: true, phoneVerifiedAt: true, createdAt: true } }),
    prisma.notificationDelivery.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, eventType: true, payload: true, createdAt: true, bookingId: true, bookingOrderId: true, rescheduleId: true, status: true } }),
    prisma.booking.findMany({ where: { userId, payment: { status: { in: [PaymentStatus.AWAITING_PAYMENT, PaymentStatus.ACTION_REQUIRED] } } }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, reference: true, createdAt: true, payment: { select: { status: true, reviewNote: true } } } }),
    prisma.bookingReschedule.findMany({ where: { booking: { userId }, status: BookingRescheduleStatus.ADDITIONAL_PAYMENT_REQUIRED }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, bookingId: true, createdAt: true, additionalPayment: { select: { status: true, reviewNote: true } } } })
  ]);

  if (!user) return null;
  const inbox = new Map<string, AccountInboxItem>();
  for (const notification of notifications) {
    const text = payloadText(notification.payload);
    const href = notification.rescheduleId && notification.bookingId
      ? `/bookings/${notification.bookingId}/reschedule-payment`
      : notification.bookingOrderId
        ? `/orders/${notification.bookingOrderId}/payment`
        : notification.bookingId
          ? `/bookings/${notification.bookingId}/payment`
          : null;
    const isActionRequired = ACTIONABLE_NOTIFICATION_EVENTS.includes(notification.eventType);
    inbox.set(notification.id, { id: notification.id, title: text.heading, message: text.message, createdAt: notification.createdAt, href, actionLabel: href ? "Review" : null, isActionRequired });
  }
  for (const booking of actionBookings) {
    inbox.set(`booking-${booking.id}`, { id: `booking-${booking.id}`, title: booking.payment?.status === PaymentStatus.ACTION_REQUIRED ? "Payment Needs Attention" : "Payment Still Required", message: booking.payment?.reviewNote ?? "Submit payment proof to keep this booking moving.", createdAt: booking.createdAt, href: `/bookings/${booking.id}/payment`, actionLabel: "Open payment", isActionRequired: true });
  }
  for (const reschedule of actionReschedules) {
    inbox.set(`reschedule-${reschedule.id}`, { id: `reschedule-${reschedule.id}`, title: "Additional payment required", message: reschedule.additionalPayment?.reviewNote ?? "Submit the additional payment proof for your rescheduled booking.", createdAt: reschedule.createdAt, href: `/bookings/${reschedule.bookingId}/reschedule-payment`, actionLabel: "Open payment", isActionRequired: true });
  }

  const normalizedSearch = options.search?.trim().toLowerCase();
  const filteredInbox = [...inbox.values()]
    .filter((item) => !normalizedSearch || `${item.title} ${item.message}`.toLowerCase().includes(normalizedSearch))
    .sort((left, right) => Number(right.isActionRequired) - Number(left.isActionRequired) || right.createdAt.getTime() - left.createdAt.getTime());
  const start = (options.page - 1) * options.pageSize;
  return { user, inbox: filteredInbox.slice(start, start + options.pageSize), totalInboxCount: filteredInbox.length, hasNewNotifications: await getCustomerAccountNotificationState(userId) };
}
