import { PrismaClient, Prisma, UserRole, FacilityType, BookingOrderStatus, BookingStatus, CartStatus, PaymentProvider, PaymentStatus, PricingBillingMode, PricingDayType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedFaqs } from "./faq-content";

const prisma = new PrismaClient();

const timezone = "Asia/Manila";
const defaultAdminEmail = "admin@sportbooking.local";
const defaultAdminPassword = "Admin12345!";
const defaultCustomerEmail = "player@sportbooking.local";
const defaultCustomerPassword = "Player12345!";
const concurrencyCustomerEmail = "player-two@sportbooking.local";
const concurrencyCustomerPassword = "Player12345!";
const localStaffAccounts = [
  { email: "receptionist@sportbooking.local", password: "Receptionist12345!", fullName: "Sample Receptionist", phone: "+639181112224", systemRoleKey: "RECEPTIONIST" },
  { email: "booking-admin@sportbooking.local", password: "BookingAdmin12345!", fullName: "Sample Booking Admin", phone: "+639181112225", systemRoleKey: "BOOKING_ADMIN" },
  { email: "social-media@sportbooking.local", password: "SocialMedia12345!", fullName: "Sample Social Media", phone: "+639181112226", systemRoleKey: "SOCIAL_MEDIA" }
] as const;
const defaultOperatingHours = [
  { dayOfWeek: 0, opensAtMinutes: 8 * 60, closesAtMinutes: 22 * 60, isClosed: false },
  { dayOfWeek: 1, opensAtMinutes: 8 * 60, closesAtMinutes: 22 * 60, isClosed: false },
  { dayOfWeek: 2, opensAtMinutes: 8 * 60, closesAtMinutes: 22 * 60, isClosed: false },
  { dayOfWeek: 3, opensAtMinutes: 8 * 60, closesAtMinutes: 22 * 60, isClosed: false },
  { dayOfWeek: 4, opensAtMinutes: 8 * 60, closesAtMinutes: 22 * 60, isClosed: false },
  { dayOfWeek: 5, opensAtMinutes: 8 * 60, closesAtMinutes: 23 * 60, isClosed: false },
  { dayOfWeek: 6, opensAtMinutes: 8 * 60, closesAtMinutes: 23 * 60, isClosed: false }
];

const centerCourtImages = [
  "/facility_photos/whole_court-1.jpg",
  "/facility_photos/whole_court-2.jpg",
  "/facility_photos/whole_court-3.jpg",
  "/facility_photos/whole_court-4.jpg",
  "/facility_photos/whole_court-5.jpg"
];

const halfCourtImages = [
  "/facility_photos/3x3-1.jpg",
  "/facility_photos/3x3-2.jpg",
  "/facility_photos/3x3-3.jpg",
  "/facility_photos/3x3-4.jpg"
];

const racketCourtImages = [
  "/facility_photos/badminton-1.jpg",
  "/facility_photos/badminton-2.jpg"
];

const facilities = [
  {
    slug: "center-court",
    name: "Center Court",
    description: "Full indoor basketball court for leagues, scrimmages, and private rentals.",
    type: FacilityType.BASKETBALL_WHOLE,
    priceMinor: 250000,
    imageUrls: centerCourtImages,
    imageAlt: "Indoor basketball court"
  },
  {
    slug: "3x3-court-a",
    name: "3x3 Court A",
    description: "Half-court setup optimized for 3x3 play, drills, and youth training sessions.",
    type: FacilityType.BASKETBALL_HALF,
    priceMinor: 120000,
    imageUrls: halfCourtImages,
    imageAlt: "Half basketball court"
  },
  {
    slug: "3x3-court-b",
    name: "3x3 Court B",
    description: "Second half-court for overflow play, private coaching, and tournament rotations.",
    type: FacilityType.BASKETBALL_HALF,
    priceMinor: 120000,
    imageUrls: halfCourtImages,
    imageAlt: "Basketball half court with players"
  },
  {
    slug: "pickleball-court-1",
    name: "Pickleball Court 1",
    description: "Dedicated pickleball court with competition markings and evening lighting.",
    type: FacilityType.PICKLEBALL,
    priceMinor: 90000,
    imageUrls: racketCourtImages,
    imageAlt: "Indoor racket court"
  },
  {
    slug: "badminton-court-1",
    name: "Badminton Court 1",
    description: "Indoor badminton lane with rubberized flooring and spectator-side clearance.",
    type: FacilityType.BADMINTON,
    priceMinor: 70000,
    imageUrls: racketCourtImages,
    imageAlt: "Indoor badminton court"
  },
  {
    slug: "badminton-court-2",
    name: "Badminton Court 2",
    description: "Second badminton court for doubles play, classes, and casual bookings.",
    type: FacilityType.BADMINTON,
    priceMinor: 70000,
    imageUrls: racketCourtImages,
    imageAlt: "Badminton courts"
  }
] as const;

async function upsertUser(params: {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  emailVerifiedAt?: Date;
  phoneVerifiedAt?: Date;
}) {
  return prisma.user.upsert({
    where: { email: params.email },
    update: {
      fullName: params.fullName,
      passwordHash: await bcrypt.hash(params.password, 10),
      phone: params.phone,
      emailVerifiedAt: params.emailVerifiedAt,
      phoneVerifiedAt: params.phoneVerifiedAt,
      role: params.role
    },
    create: {
      email: params.email,
      fullName: params.fullName,
      passwordHash: await bcrypt.hash(params.password, 10),
      phone: params.phone,
      emailVerifiedAt: params.emailVerifiedAt,
      phoneVerifiedAt: params.phoneVerifiedAt,
      role: params.role
    }
  });
}

function isLocalDatabaseUrl(value: string | undefined) {
  return Boolean(value && /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value));
}

function usesDefaultSeedCredentials(params: {
  adminEmail: string;
  adminPassword: string;
  customerEmail: string;
  customerPassword: string;
}) {
  return (
    params.adminEmail === defaultAdminEmail ||
    params.adminPassword === defaultAdminPassword ||
    params.customerEmail === defaultCustomerEmail ||
    params.customerPassword === defaultCustomerPassword
  );
}

function assertSeedTargetIsSafe(params: {
  adminEmail: string;
  adminPassword: string;
  customerEmail: string;
  customerPassword: string;
}) {
  const strictProduction = process.env.AUTH_STRICT_ENV_VALIDATION === "true" || process.env.VERCEL_ENV === "production";
  const localDatabase = isLocalDatabaseUrl(process.env.DATABASE_URL);

  if (strictProduction) {
    throw new Error("Development seed is disabled in production. Use npm run admin:bootstrap for production admin setup.");
  }

  if (!localDatabase && usesDefaultSeedCredentials(params)) {
    throw new Error(
      "Development seed defaults can only be used with a local database. Set secure SEED_* credentials or use npm run admin:bootstrap."
    );
  }
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? defaultAdminEmail;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? defaultAdminPassword;
  const customerEmail = process.env.SEED_CUSTOMER_EMAIL ?? defaultCustomerEmail;
  const customerPassword = process.env.SEED_CUSTOMER_PASSWORD ?? defaultCustomerPassword;

  assertSeedTargetIsSafe({ adminEmail, adminPassword, customerEmail, customerPassword });
  await seedFaqs(prisma);

  const admin = await upsertUser({
    email: adminEmail,
    password: adminPassword,
    fullName: "MVP Admin",
    phone: "+639171234567",
    emailVerifiedAt: new Date(),
    phoneVerifiedAt: new Date(),
    role: UserRole.ADMIN
  });

  await prisma.user.update({ where: { id: admin.id }, data: { adminAccessActive: true } });
  const superAdminRole = await prisma.role.findUnique({ where: { systemKey: "SUPER_ADMIN" }, select: { id: true } });
  if (!superAdminRole) throw new Error("RBAC migration is not deployed: Super Admin role is missing.");
  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: superAdminRole.id, assignedByUserId: admin.id }
  });

  const customer = await upsertUser({
    email: customerEmail,
    password: customerPassword,
    fullName: "Sample Player",
    phone: "+639181112222",
    emailVerifiedAt: new Date(),
    phoneVerifiedAt: new Date(),
    role: UserRole.CUSTOMER
  });

  if (isLocalDatabaseUrl(process.env.DATABASE_URL)) {
    await upsertUser({
      email: concurrencyCustomerEmail,
      password: concurrencyCustomerPassword,
      fullName: "Sample Player Two",
      phone: "+639181112223",
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      role: UserRole.CUSTOMER
    });

    for (const account of localStaffAccounts) {
      const staffUser = await upsertUser({
        email: account.email,
        password: account.password,
        fullName: account.fullName,
        phone: account.phone,
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
        role: UserRole.ADMIN
      });
      const role = await prisma.role.findUnique({ where: { systemKey: account.systemRoleKey }, select: { id: true } });
      if (!role) throw new Error(`RBAC migration is not deployed: ${account.systemRoleKey} role is missing.`);
      await prisma.user.update({ where: { id: staffUser.id }, data: { adminAccessActive: true } });
      await prisma.userRoleAssignment.upsert({
        where: { userId_roleId: { userId: staffUser.id, roleId: role.id } },
        update: {},
        create: { userId: staffUser.id, roleId: role.id, assignedByUserId: admin.id }
      });
    }
  }

  const facilityRecords = await Promise.all(
    facilities.map(async (facility) =>
      prisma.facility.upsert({
        where: { slug: facility.slug },
        update: {
          name: facility.name,
          description: facility.description,
          type: facility.type,
          timezone,
          isEnabled: true,
          slotIntervalMinutes: 30,
          images: {
            deleteMany: {},
            create: facility.imageUrls.map((url, index) => ({
              url,
              altText: `${facility.imageAlt} ${index + 1}`,
              sortOrder: index
            }))
          },
          operatingHours: {
            deleteMany: {},
            create: defaultOperatingHours
          },
          pricingRules: {
            deleteMany: {},
            create: [
              {
                name: "Default rate",
                customerLabel: "Standard base rate",
                dayType: PricingDayType.DEFAULT,
                currency: "PHP",
                amountMinor: facility.priceMinor,
                billingMode: PricingBillingMode.PER_HOUR,
                minimumMinutes: 60,
                isActive: true,
                createdByUserId: admin.id,
                updatedByUserId: admin.id
              }
            ]
          }
        },
        create: {
          slug: facility.slug,
          name: facility.name,
          description: facility.description,
          type: facility.type,
          timezone,
          isEnabled: true,
          slotIntervalMinutes: 30,
          images: {
            create: facility.imageUrls.map((url, index) => ({
              url,
              altText: `${facility.imageAlt} ${index + 1}`,
              sortOrder: index
            }))
          },
          operatingHours: {
            create: defaultOperatingHours
          },
          pricingRules: {
            create: [
              {
                name: "Default rate",
                customerLabel: "Standard base rate",
                dayType: PricingDayType.DEFAULT,
                currency: "PHP",
                amountMinor: facility.priceMinor,
                billingMode: PricingBillingMode.PER_HOUR,
                minimumMinutes: 60,
                isActive: true,
                createdByUserId: admin.id,
                updatedByUserId: admin.id
              }
            ]
          }
        }
      })
    )
  );

  const centerCourt = facilityRecords.find((facility) => facility.slug === "center-court");
  const pickleballCourt = facilityRecords.find((facility) => facility.slug === "pickleball-court-1");

  if (!centerCourt || !pickleballCourt) {
    throw new Error("Seed facilities were not created correctly.");
  }

  if (isLocalDatabaseUrl(process.env.DATABASE_URL)) {
    const expiredOrderCart = await prisma.cart.upsert({
      where: { id: "seed-expired-order-cart" },
      update: { userId: customer.id, status: CartStatus.CHECKED_OUT, currency: "PHP", expiresAt: null },
      create: { id: "seed-expired-order-cart", userId: customer.id, status: CartStatus.CHECKED_OUT, currency: "PHP", expiresAt: null }
    });
    const expiredOrder = await prisma.bookingOrder.upsert({
      where: { id: "seed-expired-order" },
      update: {
        userId: customer.id,
        cartId: expiredOrderCart.id,
        reference: "PG-OR-EXPIRED-UAT",
        status: BookingOrderStatus.PENDING_PAYMENT,
        currency: "PHP",
        vatTreatment: "VAT_EXCLUSIVE",
        baseAmountMinor: 90000,
        amountPaidMinor: null,
        outstandingAmountMinor: 90000,
        checkoutSnapshot: { version: 1, source: "seed", baseAmountMinor: 90000 } as Prisma.InputJsonValue,
        checkoutAt: new Date("2026-04-13T03:00:00.000Z"),
        paymentDeadline: new Date("2026-04-13T03:15:00.000Z"),
        proofSubmittedAt: null,
        verifiedAt: null,
        rejectedAt: null,
        expiredAt: null,
        cancelledAt: null,
        version: 1
      },
      create: {
        id: "seed-expired-order",
        userId: customer.id,
        cartId: expiredOrderCart.id,
        reference: "PG-OR-EXPIRED-UAT",
        status: BookingOrderStatus.PENDING_PAYMENT,
        currency: "PHP",
        vatTreatment: "VAT_EXCLUSIVE",
        baseAmountMinor: 90000,
        outstandingAmountMinor: 90000,
        checkoutSnapshot: { version: 1, source: "seed", baseAmountMinor: 90000 } as Prisma.InputJsonValue,
        checkoutAt: new Date("2026-04-13T03:00:00.000Z"),
        paymentDeadline: new Date("2026-04-13T03:15:00.000Z"),
        idempotencyKey: "seed-expired-order-idempotency"
      }
    });
    await prisma.booking.upsert({
      where: { id: "seed-expired-order-booking" },
      update: {
        reference: "PG-BK-EXPIRED-UAT",
        userId: customer.id,
        facilityId: pickleballCourt.id,
        bookingOrderId: expiredOrder.id,
        orderItemSequence: 1,
        status: BookingStatus.HELD,
        startAtUtc: new Date("2026-10-15T00:00:00.000Z"),
        endAtUtc: new Date("2026-10-15T01:00:00.000Z"),
        timezone,
        slotCount: 2,
        amountMinor: 90000,
        currency: "PHP",
        paymentHoldExpiresAt: new Date("2026-04-13T03:15:00.000Z"),
        cancelledAt: null,
        cancellationReason: null
      },
      create: {
        id: "seed-expired-order-booking",
        reference: "PG-BK-EXPIRED-UAT",
        userId: customer.id,
        facilityId: pickleballCourt.id,
        bookingOrderId: expiredOrder.id,
        orderItemSequence: 1,
        status: BookingStatus.HELD,
        startAtUtc: new Date("2026-10-15T00:00:00.000Z"),
        endAtUtc: new Date("2026-10-15T01:00:00.000Z"),
        timezone,
        slotCount: 2,
        amountMinor: 90000,
        currency: "PHP",
        paymentHoldExpiresAt: new Date("2026-04-13T03:15:00.000Z")
      }
    });
    await prisma.payment.upsert({
      where: { bookingOrderId: expiredOrder.id },
      update: {
        provider: PaymentProvider.MANUAL,
        providerReference: "PG-OR-EXPIRED-UAT",
        method: "manual_gcash",
        status: PaymentStatus.AWAITING_PAYMENT,
        amountMinor: 90000,
        currency: "PHP",
        expiresAt: new Date("2026-04-13T03:15:00.000Z"),
        proofImageUrl: null,
        submittedAt: null,
        verifiedAt: null,
        rejectedAt: null,
        reviewNote: null
      },
      create: {
        bookingOrderId: expiredOrder.id,
        provider: PaymentProvider.MANUAL,
        providerReference: "PG-OR-EXPIRED-UAT",
        method: "manual_gcash",
        status: PaymentStatus.AWAITING_PAYMENT,
        amountMinor: 90000,
        currency: "PHP",
        expiresAt: new Date("2026-04-13T03:15:00.000Z")
      }
    });
  }

  await prisma.pricingRule.createMany({
    data: [
      { facilityId: centerCourt.id, name: "Weekday daytime", customerLabel: "Weekday daytime base rate", dayType: PricingDayType.WEEKDAY, startMinutes: 480, endMinutes: 1020, currency: "PHP", amountMinor: 150000, billingMode: PricingBillingMode.PER_HOUR, minimumMinutes: 60, priority: 0, displayOrder: 10, isActive: true, createdByUserId: admin.id, updatedByUserId: admin.id },
      { facilityId: centerCourt.id, name: "Weekday evening", customerLabel: "Weekday evening base rate", dayType: PricingDayType.WEEKDAY, startMinutes: 1020, endMinutes: 1440, currency: "PHP", amountMinor: 200000, billingMode: PricingBillingMode.PER_HOUR, minimumMinutes: 60, priority: 0, displayOrder: 20, isActive: true, createdByUserId: admin.id, updatedByUserId: admin.id },
      { facilityId: centerCourt.id, name: "Weekend rate", customerLabel: "Weekend base rate", dayType: PricingDayType.WEEKEND, startMinutes: 0, endMinutes: 1440, currency: "PHP", amountMinor: 200000, billingMode: PricingBillingMode.PER_HOUR, minimumMinutes: 60, priority: 0, displayOrder: 30, isActive: true, createdByUserId: admin.id, updatedByUserId: admin.id },
      { facilityId: centerCourt.id, name: "Holiday rate", customerLabel: "Holiday base rate", dayType: PricingDayType.HOLIDAY, startMinutes: 0, endMinutes: 1440, currency: "PHP", amountMinor: 230000, billingMode: PricingBillingMode.PER_HOUR, minimumMinutes: 60, priority: 0, displayOrder: 50, isActive: true, createdByUserId: admin.id, updatedByUserId: admin.id }
    ]
  });

  const sampleHolidayDate = new Date("2026-12-25T00:00:00.000Z");
  await prisma.holiday.deleteMany({ where: { facilityId: null, date: sampleHolidayDate, name: "Christmas Day" } });
  await prisma.holiday.create({
    data: { name: "Christmas Day", date: sampleHolidayDate, isActive: true, createdByUserId: admin.id, updatedByUserId: admin.id }
  });

  await prisma.appSetting.upsert({
    where: { key: "booking.paymentHoldMinutes" },
    update: { value: 15 },
    create: { key: "booking.paymentHoldMinutes", value: 15 as Prisma.InputJsonValue }
  });

  await prisma.appSetting.upsert({
    where: { key: "booking.cancellationEnabled" },
    update: { value: true },
    create: { key: "booking.cancellationEnabled", value: true as Prisma.InputJsonValue }
  });

  await prisma.appSetting.upsert({
    where: { key: "booking.cancellationWindowHours" },
    update: { value: 24 },
    create: { key: "booking.cancellationWindowHours", value: 24 as Prisma.InputJsonValue }
  });

  await prisma.appSetting.upsert({
    where: { key: "payments.mockAutoConfirmEnabled" },
    update: { value: true },
    create: { key: "payments.mockAutoConfirmEnabled", value: true as Prisma.InputJsonValue }
  });

  const confirmedBooking = await prisma.booking.upsert({
    where: { id: "seed-confirmed-booking" },
    update: {
      userId: customer.id,
      facilityId: centerCourt.id,
      status: BookingStatus.CONFIRMED,
      startAtUtc: new Date("2026-04-18T10:00:00.000Z"),
      endAtUtc: new Date("2026-04-18T11:00:00.000Z"),
      timezone,
      slotCount: 2,
      amountMinor: 250000,
      currency: "PHP",
      paymentHoldExpiresAt: null,
      cancelledAt: null,
      cancellationReason: null
    },
    create: {
      id: "seed-confirmed-booking",
      userId: customer.id,
      facilityId: centerCourt.id,
      status: BookingStatus.CONFIRMED,
      startAtUtc: new Date("2026-04-18T10:00:00.000Z"),
      endAtUtc: new Date("2026-04-18T11:00:00.000Z"),
      timezone,
      slotCount: 2,
      amountMinor: 250000,
      currency: "PHP"
    }
  });

  await prisma.payment.upsert({
    where: { bookingId: confirmedBooking.id },
    update: {
      provider: PaymentProvider.MOCK,
      providerReference: "mock_seed_confirmed_001",
      checkoutUrl: null,
      status: PaymentStatus.PAID,
      amountMinor: 250000,
      currency: "PHP",
      paidAt: new Date("2026-04-13T01:15:00.000Z"),
      rawPayload: { source: "seed" } as Prisma.InputJsonValue
    },
    create: {
      bookingId: confirmedBooking.id,
      provider: PaymentProvider.MOCK,
      providerReference: "mock_seed_confirmed_001",
      checkoutUrl: null,
      status: PaymentStatus.PAID,
      amountMinor: 250000,
      currency: "PHP",
      paidAt: new Date("2026-04-13T01:15:00.000Z"),
      rawPayload: { source: "seed" } as Prisma.InputJsonValue
    }
  });

  await prisma.booking.upsert({
    where: { id: "seed-pending-booking" },
    update: {
      userId: customer.id,
      facilityId: pickleballCourt.id,
      status: BookingStatus.HELD,
      startAtUtc: new Date("2026-04-20T08:00:00.000Z"),
      endAtUtc: new Date("2026-04-20T09:00:00.000Z"),
      timezone,
      slotCount: 2,
      amountMinor: 90000,
      currency: "PHP",
      paymentHoldExpiresAt: new Date("2026-04-13T03:15:00.000Z")
    },
    create: {
      id: "seed-pending-booking",
      userId: customer.id,
      facilityId: pickleballCourt.id,
      status: BookingStatus.HELD,
      startAtUtc: new Date("2026-04-20T08:00:00.000Z"),
      endAtUtc: new Date("2026-04-20T09:00:00.000Z"),
      timezone,
      slotCount: 2,
      amountMinor: 90000,
      currency: "PHP",
      paymentHoldExpiresAt: new Date("2026-04-13T03:15:00.000Z")
    }
  });

  await prisma.payment.upsert({
    where: { bookingId: "seed-pending-booking" },
    update: {
      provider: PaymentProvider.MANUAL,
      providerReference: "mock_seed_pending_001",
      method: "manual_gcash",
      status: PaymentStatus.AWAITING_PAYMENT,
      amountMinor: 90000,
      currency: "PHP",
      paidAt: null,
      submittedAt: null,
      verifiedAt: null,
      verifiedByUserId: null,
      rejectedAt: null,
      actionRequiredAt: null,
      expiresAt: new Date("2026-04-13T03:15:00.000Z"),
      proofImageUrl: null,
      externalReference: null,
      normalizedExternalReference: null,
      reviewNote: null,
      rawPayload: { source: "seed" } as Prisma.InputJsonValue
    },
    create: {
      bookingId: "seed-pending-booking",
      provider: PaymentProvider.MANUAL,
      providerReference: "mock_seed_pending_001",
      method: "manual_gcash",
      status: PaymentStatus.AWAITING_PAYMENT,
      amountMinor: 90000,
      currency: "PHP",
      expiresAt: new Date("2026-04-13T03:15:00.000Z"),
      rawPayload: { source: "seed" } as Prisma.InputJsonValue
    }
  });

  await prisma.blockedSchedule.upsert({
    where: { id: "seed-maintenance-block" },
    update: {
      facilityId: centerCourt.id,
      title: "Maintenance window",
      reason: "Backboard inspection and floor cleaning",
      startAtUtc: new Date("2026-04-22T04:00:00.000Z"),
      endAtUtc: new Date("2026-04-22T06:00:00.000Z"),
      createdByUserId: admin.id
    },
    create: {
      id: "seed-maintenance-block",
      facilityId: centerCourt.id,
      title: "Maintenance window",
      reason: "Backboard inspection and floor cleaning",
      startAtUtc: new Date("2026-04-22T04:00:00.000Z"),
      endAtUtc: new Date("2026-04-22T06:00:00.000Z"),
      createdByUserId: admin.id
    }
  });

  console.log("Seed complete.");
  console.log(`Seeded admin account: ${adminEmail}`);
  console.log(`Seeded customer account: ${customerEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
