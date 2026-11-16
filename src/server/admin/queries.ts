import { BookingStatus, PaymentStatus } from "@prisma/client";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

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
      where: {
        endAtUtc: { gte: new Date() }
      },
      orderBy: { startAtUtc: "asc" },
      take: 100,
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
  const now = new Date();
  const reportEndDate = formatInTimeZone(now, "Asia/Manila", "yyyy-MM-dd");
  const reportStartDate = formatInTimeZone(
    new Date(`${reportEndDate}T00:00:00.000Z`).getTime() - 29 * 24 * 60 * 60 * 1000,
    "UTC",
    "yyyy-MM-dd"
  );
  const reportEndDateExclusive = new Date(`${reportEndDate}T00:00:00.000Z`);
  reportEndDateExclusive.setUTCDate(reportEndDateExclusive.getUTCDate() + 1);
  const reportEndDateExclusiveKey = reportEndDateExclusive.toISOString().slice(0, 10);
  const reportStart = fromZonedTime(`${reportStartDate}T00:00:00`, "Asia/Manila");
  const reportEnd = fromZonedTime(`${reportEndDateExclusiveKey}T00:00:00`, "Asia/Manila");
  const dateKeys = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(`${reportStartDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });

  const [bookings, facilities] = await Promise.all([
    prisma.booking.findMany({
      where: {
        startAtUtc: {
          gte: reportStart,
          lt: reportEnd
        }
      },
      include: {
        payment: true
      }
    }),
    prisma.facility.findMany({
      where: { isEnabled: true },
      include: {
        operatingHours: true,
        blockedSchedules: {
          where: {
            startAtUtc: { lt: reportEnd },
            endAtUtc: { gt: reportStart }
          },
          select: { startAtUtc: true, endAtUtc: true }
        }
      }
    })
  ]);

  const utilization = facilities.map((facility) => {
    let bookableMilliseconds = 0;
    let bookedMilliseconds = 0;
    const facilityBookings = bookings.filter((booking) => booking.facilityId === facility.id && booking.status === BookingStatus.CONFIRMED);

    for (const dateKey of dateKeys) {
      const weekday = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
      const schedule = facility.operatingHours.find((hours) => hours.dayOfWeek === weekday && !hours.isClosed);
      if (!schedule || schedule.closesAtMinutes <= schedule.opensAtMinutes) continue;

      const startOfDate = new Date(`${dateKey}T00:00:00.000Z`);
      const toLocalInstant = (minutes: number) => {
        const localDateTime = new Date(startOfDate);
        localDateTime.setUTCMinutes(minutes);
        return fromZonedTime(`${localDateTime.toISOString().slice(0, 16)}:00`, facility.timezone);
      };
      const openStart = toLocalInstant(schedule.opensAtMinutes).getTime();
      const openEnd = toLocalInstant(schedule.closesAtMinutes).getTime();
      const blocked = facility.blockedSchedules
        .map((block) => ({
          start: Math.max(block.startAtUtc.getTime(), openStart),
          end: Math.min(block.endAtUtc.getTime(), openEnd)
        }))
        .filter((range) => range.start < range.end)
        .sort((left, right) => left.start - right.start);
      let blockedMilliseconds = 0;
      let mergedBlock: { start: number; end: number } | null = null;

      for (const range of blocked) {
        if (!mergedBlock) {
          mergedBlock = { ...range };
        } else if (range.start <= mergedBlock.end) {
          mergedBlock.end = Math.max(mergedBlock.end, range.end);
        } else {
          blockedMilliseconds += mergedBlock.end - mergedBlock.start;
          mergedBlock = { ...range };
        }
      }
      if (mergedBlock) blockedMilliseconds += mergedBlock.end - mergedBlock.start;

      bookableMilliseconds += Math.max(0, openEnd - openStart - blockedMilliseconds);
      for (const booking of facilityBookings) {
        bookedMilliseconds += Math.max(
          0,
          Math.min(booking.endAtUtc.getTime(), openEnd) - Math.max(booking.startAtUtc.getTime(), openStart)
        );
      }
    }

    const bookedMinutes = bookedMilliseconds / 60_000;
    return {
      facilityId: facility.id,
      name: facility.name,
      bookableMinutes: bookableMilliseconds / 60_000,
      bookedMinutes,
      rate: bookableMilliseconds > 0 ? (bookedMilliseconds / bookableMilliseconds) * 100 : 0
    };
  });

  return {
    bookings,
    facilities,
    reportStart,
    reportEnd: new Date(reportEnd.getTime() - 1),
    utilization
  };
}
