import { BookingStatus, PaymentStatus, Prisma } from "@prisma/client";
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

export async function getAdminOverviewData(options: { fullCustomerAccess: boolean; includeFinancials: boolean; includePaymentDetails: boolean }) {
  const recentBookingQuery = options.fullCustomerAccess
    ? prisma.booking.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          facility: { select: { name: true } },
          user: { select: { fullName: true, email: true } },
          payment: { select: { status: true, provider: true } },
          bookingOrder: { select: { payment: { select: { status: true, provider: true } } } }
        }
      })
    : prisma.booking.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          facility: { select: { name: true } },
          user: { select: { fullName: true } },
          payment: { select: { status: true } },
          bookingOrder: { select: { payment: { select: { status: true } } } }
        }
      });
  const [recentBookings, paidPayments, enabledFacilities, cancellationEnabled, cancellationWindowHours] = await Promise.all([
    recentBookingQuery,
    options.includeFinancials ? prisma.payment.findMany({
      where: { status: { in: [PaymentStatus.PAID, PaymentStatus.VERIFIED] } }
    }) : Promise.resolve([]),
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
    recentBookings: recentBookings.map((booking) => {
      const effectivePayment = booking.payment ?? booking.bookingOrder?.payment ?? null;
      return {
      id: booking.id,
      status: booking.status,
      facility: booking.facility,
      customerName: booking.user.fullName,
      customerContact: "email" in booking.user ? booking.user.email : null,
      payment: effectivePayment ? {
        status: effectivePayment.status,
        provider: options.includePaymentDetails && "provider" in effectivePayment ? String(effectivePayment.provider) : null
      } : null
    };}),
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
        bookingOrder: {
          include: {
            user: { select: { fullName: true, email: true, phone: true } },
            bookings: {
              orderBy: { orderItemSequence: "asc" },
              include: { facility: { select: { name: true, timezone: true } } }
            }
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
      bookingOrder: {
        include: {
          user: { select: { fullName: true, email: true, phone: true } },
          bookings: {
            orderBy: { orderItemSequence: "asc" },
            include: { facility: { select: { name: true, timezone: true } } }
          },
          paymentAllocations: true
        }
      },
      verifiedBy: { select: { fullName: true, email: true } }
    }
  });
}

export async function getAdminBookingOrdersData(options: { page: number; pageSize: number; search?: string; includeFullCustomer: boolean }) {
  const search = options.search?.trim();
  const customerSearch: Prisma.UserWhereInput[] = options.includeFullCustomer && search
    ? [{ fullName: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }]
    : search ? [{ fullName: { contains: search, mode: "insensitive" } }] : [];
  const where: Prisma.BookingOrderWhereInput = search ? {
    OR: [
      { reference: { contains: search, mode: "insensitive" } },
      { bookings: { some: { reference: { contains: search, mode: "insensitive" } } } },
      { bookings: { some: { facility: { name: { contains: search, mode: "insensitive" } } } } },
      ...customerSearch.map((condition) => ({ user: condition }))
    ]
  } : {};
  const [orders, totalCount] = await prisma.$transaction([
    prisma.bookingOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      include: {
        user: { select: options.includeFullCustomer ? { fullName: true, email: true, phone: true } : { fullName: true } },
        payment: { select: { id: true, status: true, amountMinor: true, verifiedAt: true } },
        bookings: { orderBy: { orderItemSequence: "asc" }, include: { facility: { select: { name: true } } } }
      }
    }),
    prisma.bookingOrder.count({ where })
  ]);
  return {
    orders: orders.map((order) => ({
      ...order,
      customerContact: "email" in order.user && typeof order.user.email === "string" ? order.user.email : null
    })),
    totalCount
  };
}

export async function getAdminBookingDetailData(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: { select: { id: true, fullName: true } },
      facility: true,
      payment: { include: { verifiedBy: { select: { fullName: true } } } },
      bookingOrder: {
        include: {
          payment: { include: { verifiedBy: { select: { fullName: true } } } },
          paymentAllocations: true
        }
      },
      reschedules: {
        orderBy: { createdAt: "desc" },
        include: {
          originalFacility: { select: { name: true } },
          replacementFacility: { select: { name: true } },
          initiatedBy: { select: { fullName: true } },
          finalizedBy: { select: { fullName: true } },
          resolvedBy: { select: { fullName: true } },
          additionalPayment: { include: { verifiedBy: { select: { fullName: true } } } }
        }
      }
    }
  });
}

export async function getReschedulePaymentQueueData(options: { page: number; pageSize: number }) {
  const where = { status: PaymentStatus.SUBMITTED } as const;
  const [payments, totalCount] = await prisma.$transaction([
    prisma.reschedulePayment.findMany({
      where,
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      orderBy: { submittedAt: "asc" },
      include: {
        bookingReschedule: {
          include: {
            booking: { include: { user: { select: { fullName: true, email: true, phone: true } } } },
            originalFacility: { select: { name: true } },
            replacementFacility: { select: { name: true } }
          }
        }
      }
    }),
    prisma.reschedulePayment.count({ where })
  ]);
  return { payments, totalCount };
}

export async function getAdminReschedulePaymentDetailData(paymentId: string) {
  return prisma.reschedulePayment.findUnique({
    where: { id: paymentId },
    include: {
      verifiedBy: { select: { fullName: true } },
      bookingReschedule: {
        include: {
          booking: { include: { user: { select: { fullName: true, email: true, phone: true } } } },
          originalFacility: { select: { name: true } },
          replacementFacility: { select: { name: true } },
          initiatedBy: { select: { fullName: true } }
        }
      }
    }
  });
}

export async function getAdminFacilitiesData() {
  const [facilities, blocks, cancellationEnabled] = await Promise.all([
    prisma.facility.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        pricingRules: { where: { isActive: true, dayType: "DEFAULT" }, orderBy: { createdAt: "desc" }, take: 1 },
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

type AdminCustomersOptions = {
  page: number;
  pageSize: number;
  search?: string;
  selectedCustomerId?: string;
  bookingPage: number;
  bookingPageSize: number;
};

export async function getAdminCustomersData(options: AdminCustomersOptions) {
  const search = options.search?.trim() ?? "";
  const where: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    ...(search ? {
      OR: [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } }
      ]
    } : {})
  };

  const selectedCustomerQuery = options.selectedCustomerId ? prisma.user.findFirst({
    where: { id: options.selectedCustomerId, role: "CUSTOMER" },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      createdAt: true,
      _count: { select: { bookings: true } },
      bookings: {
        orderBy: [{ startAtUtc: "desc" }, { createdAt: "desc" }],
        skip: (options.bookingPage - 1) * options.bookingPageSize,
        take: options.bookingPageSize,
        include: {
          facility: { select: { name: true, timezone: true } },
          payment: {
            select: {
              provider: true,
              providerReference: true,
              method: true,
              externalReference: true,
              amountMinor: true,
              amountPaidMinor: true,
              currency: true,
              status: true,
              proofImageUrl: true,
              submittedAt: true,
              paidAt: true,
              verifiedAt: true,
              reviewNote: true
            }
          },
          bookingOrder: {
            select: {
              reference: true,
              payment: {
                select: {
                  provider: true,
                  providerReference: true,
                  method: true,
                  externalReference: true,
                  amountMinor: true,
                  amountPaidMinor: true,
                  currency: true,
                  status: true,
                  proofImageUrl: true,
                  submittedAt: true,
                  paidAt: true,
                  verifiedAt: true,
                  reviewNote: true
                }
              }
            }
          }
        }
      }
    }
  }) : Promise.resolve(null);

  const [customers, totalCount, selectedCustomer] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ fullName: "asc" }, { createdAt: "desc" }],
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        createdAt: true,
        _count: { select: { bookings: true } }
      }
    }),
    prisma.user.count({ where }),
    selectedCustomerQuery
  ]);

  const selectedBookingCount = selectedCustomer?._count.bookings ?? 0;
  return { customers, totalCount, selectedCustomer, selectedBookingCount };
}

export async function getAdminReportsData() {
  const reportStart = subDays(new Date(), 30);

  const [bookings, facilities, orderPayments, additionalPayments, reschedules] = await Promise.all([
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
    }),
    prisma.payment.findMany({
      where: { bookingOrderId: { not: null }, status: { in: [PaymentStatus.PAID, PaymentStatus.VERIFIED] }, verifiedAt: { gte: reportStart } },
      select: { amountMinor: true }
    }),
    prisma.reschedulePayment.findMany({
      where: { status: PaymentStatus.VERIFIED, verifiedAt: { gte: reportStart } },
      select: { amountMinor: true }
    }),
    prisma.bookingReschedule.findMany({
      where: { createdAt: { gte: reportStart } },
      orderBy: { createdAt: "desc" },
      include: {
        booking: { select: { id: true } },
        originalFacility: { select: { name: true } },
        replacementFacility: { select: { name: true } },
        initiatedBy: { select: { fullName: true } }
      }
    })
  ]);

  return {
    bookings,
    facilities,
    orderPayments,
    additionalPayments,
    reschedules,
    reportStart
  };
}
