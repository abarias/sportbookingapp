import { BookingStatus, PaymentStatus } from "@prisma/client";
import { subDays } from "date-fns";

import { prisma } from "@/lib/db/prisma";

export async function getCancellationSetting() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: "booking.cancellationEnabled" }
  });

  return setting?.value === true;
}

export async function getAdminOverviewData() {
  const [recentBookings, paidPayments, enabledFacilities, cancellationEnabled] = await Promise.all([
    prisma.booking.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        facility: { select: { name: true } },
        user: { select: { fullName: true, email: true } },
        payment: { select: { status: true, provider: true } }
      }
    }),
    prisma.payment.findMany({
      where: { status: PaymentStatus.PAID }
    }),
    prisma.facility.count({
      where: { isEnabled: true }
    }),
    getCancellationSetting()
  ]);

  const confirmedCount = recentBookings.filter((booking) => booking.status === BookingStatus.CONFIRMED).length;
  const pendingCount = recentBookings.filter((booking) => booking.status === BookingStatus.PENDING_PAYMENT).length;
  const cancelledCount = recentBookings.filter((booking) =>
    booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.EXPIRED
  ).length;
  const paidRevenueMinor = paidPayments.reduce((sum, payment) => sum + payment.amountMinor, 0);

  return {
    stats: {
      confirmedCount,
      pendingCount,
      cancelledCount,
      paidRevenueMinor,
      enabledFacilities
    },
    recentBookings,
    cancellationEnabled
  };
}

export async function getAdminFacilitiesData() {
  const [facilities, blocks, cancellationEnabled] = await Promise.all([
    prisma.facility.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        pricingRules: { where: { isActive: true }, orderBy: { createdAt: "desc" }, take: 1 },
        operatingHours: { orderBy: { dayOfWeek: "asc" } },
        bookings: {
          where: {
            status: BookingStatus.CONFIRMED
          }
        }
      }
    }),
    prisma.blockedSchedule.findMany({
      orderBy: { startAtUtc: "asc" },
      take: 20,
      include: {
        facility: { select: { name: true, timezone: true } },
        createdBy: { select: { fullName: true } }
      }
    }),
    getCancellationSetting()
  ]);

  return {
    facilities,
    blocks,
    cancellationEnabled
  };
}

export async function getAdminCustomersData() {
  const customers = await prisma.user.findMany({
    where: { role: "CUSTOMER" },
    orderBy: { createdAt: "desc" },
    include: {
      bookings: {
        orderBy: { startAtUtc: "desc" },
        include: {
          facility: { select: { name: true } },
          payment: { select: { status: true, provider: true } }
        }
      }
    }
  });

  return customers;
}

export async function getAdminReportsData() {
  const reportStart = subDays(new Date(), 30);

  const [bookings, facilities] = await Promise.all([
    prisma.booking.findMany({
      where: {
        startAtUtc: {
          gte: reportStart
        }
      },
      include: {
        facility: {
          include: {
            operatingHours: true
          }
        },
        payment: true
      }
    }),
    prisma.facility.findMany({
      where: { isEnabled: true },
      include: {
        operatingHours: true
      }
    })
  ]);

  return {
    bookings,
    facilities,
    reportStart
  };
}
