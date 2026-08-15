import { BookingStatus, PaymentStatus } from "@prisma/client";
import { subDays } from "date-fns";

import { prisma } from "@/lib/db/prisma";

export async function getCancellationSetting() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: "booking.cancellationEnabled" }
  });

  return setting?.value === true;
}

export async function getCancellationWindowHoursSetting() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: "booking.cancellationWindowHours" }
  });

  return typeof setting?.value === "number" ? setting.value : 24;
}

export async function getAdminOverviewData() {
  const [recentBookings, paidPayments, enabledFacilities, cancellationEnabled, cancellationWindowHours] = await Promise.all([
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
      where: { status: { in: [PaymentStatus.PAID, PaymentStatus.VERIFIED] } }
    }),
    prisma.facility.count({
      where: { isEnabled: true }
    }),
    getCancellationSetting(),
    getCancellationWindowHoursSetting()
  ]);

  const confirmedCount = recentBookings.filter((booking) => booking.status === BookingStatus.CONFIRMED).length;
  const pendingCount = recentBookings.filter((booking) =>
    booking.status === BookingStatus.PENDING_PAYMENT || booking.status === BookingStatus.HELD
  ).length;
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
    cancellationEnabled,
    cancellationWindowHours
  };
}

type AdminPaymentQueueOptions = {
  page: number;
  pageSize: number;
};

export async function getAdminPaymentQueueData({ page, pageSize }: AdminPaymentQueueOptions) {
  const where = {
    status: {
      in: [PaymentStatus.SUBMITTED, PaymentStatus.ACTION_REQUIRED]
    }
  };

  const [payments, totalCount, submittedCount, actionRequiredCount, duplicateCount] = await prisma.$transaction([
    prisma.payment.findMany({
      where,
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        booking: {
          include: {
            facility: { select: { name: true, timezone: true } },
            user: { select: { fullName: true, email: true, phone: true } }
          }
        },
        verifiedBy: { select: { fullName: true, email: true } }
      }
    }),
    prisma.payment.count({ where }),
    prisma.payment.count({ where: { ...where, status: PaymentStatus.SUBMITTED } }),
    prisma.payment.count({ where: { ...where, status: PaymentStatus.ACTION_REQUIRED } }),
    prisma.payment.count({ where: { ...where, duplicateReference: true } })
  ]);

  return { payments, totalCount, submittedCount, actionRequiredCount, duplicateCount };
}

export async function getAdminPaymentDetailData(paymentId: string) {
  return prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      booking: {
        include: {
          facility: { select: { name: true, timezone: true } },
          user: { select: { fullName: true, email: true, phone: true } }
        }
      },
      verifiedBy: { select: { fullName: true, email: true } }
    }
  });
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
