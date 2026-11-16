import { NotificationDeliveryStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    notificationDelivery: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    }
  },
  sendBookingLifecycleEmail: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/notifications/email", () => ({
  sendBookingLifecycleEmail: mocks.sendBookingLifecycleEmail
}));

import { deliverPendingRescheduleNotifications } from "./rescheduling";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.notificationDelivery.updateMany.mockResolvedValue({ count: 0 });
  mocks.prisma.notificationDelivery.update.mockResolvedValue({});
  mocks.sendBookingLifecycleEmail.mockResolvedValue(undefined);
});

describe("reschedule notification outbox", () => {
  it("claims and sends a pending message exactly once", async () => {
    mocks.prisma.notificationDelivery.findMany.mockResolvedValue([{
      id: "notification-1",
      status: NotificationDeliveryStatus.PENDING,
      payload: { subject: "Subject", heading: "Heading", lines: ["Customer-safe detail"] },
      user: { email: "customer@example.com", fullName: "Customer" }
    }]);
    mocks.prisma.notificationDelivery.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    await expect(deliverPendingRescheduleNotifications()).resolves.toEqual({ sentCount: 1, failedCount: 0 });
    expect(mocks.sendBookingLifecycleEmail).toHaveBeenCalledOnce();
    expect(mocks.prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: "notification-1" },
      data: { status: NotificationDeliveryStatus.SENT, sentAt: expect.any(Date) }
    });
  });

  it("does not send when another worker already claimed the message", async () => {
    mocks.prisma.notificationDelivery.findMany.mockResolvedValue([{
      id: "notification-1",
      status: NotificationDeliveryStatus.PENDING,
      payload: { subject: "Subject", heading: "Heading", lines: [] },
      user: { email: "customer@example.com", fullName: "Customer" }
    }]);
    mocks.prisma.notificationDelivery.updateMany.mockResolvedValue({ count: 0 });

    await expect(deliverPendingRescheduleNotifications()).resolves.toEqual({ sentCount: 0, failedCount: 0 });
    expect(mocks.sendBookingLifecycleEmail).not.toHaveBeenCalled();
  });
});
