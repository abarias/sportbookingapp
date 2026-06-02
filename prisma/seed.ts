import { PrismaClient, Prisma, UserRole, FacilityType, BookingStatus, PaymentProvider, PaymentStatus, PricingBillingMode } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const timezone = "Asia/Manila";
const defaultOperatingHours = [
  { dayOfWeek: 0, opensAtMinutes: 8 * 60, closesAtMinutes: 22 * 60, isClosed: false },
  { dayOfWeek: 1, opensAtMinutes: 8 * 60, closesAtMinutes: 22 * 60, isClosed: false },
  { dayOfWeek: 2, opensAtMinutes: 8 * 60, closesAtMinutes: 22 * 60, isClosed: false },
  { dayOfWeek: 3, opensAtMinutes: 8 * 60, closesAtMinutes: 22 * 60, isClosed: false },
  { dayOfWeek: 4, opensAtMinutes: 8 * 60, closesAtMinutes: 22 * 60, isClosed: false },
  { dayOfWeek: 5, opensAtMinutes: 8 * 60, closesAtMinutes: 23 * 60, isClosed: false },
  { dayOfWeek: 6, opensAtMinutes: 8 * 60, closesAtMinutes: 23 * 60, isClosed: false }
];

const facilities = [
  {
    slug: "center-court",
    name: "Center Court",
    description: "Full indoor basketball court for leagues, scrimmages, and private rentals.",
    type: FacilityType.BASKETBALL_WHOLE,
    priceMinor: 250000,
    imageUrl: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Indoor basketball court"
  },
  {
    slug: "3x3-court-a",
    name: "3x3 Court A",
    description: "Half-court setup optimized for 3x3 play, drills, and youth training sessions.",
    type: FacilityType.BASKETBALL_HALF,
    priceMinor: 120000,
    imageUrl: "https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Half basketball court"
  },
  {
    slug: "3x3-court-b",
    name: "3x3 Court B",
    description: "Second half-court for overflow play, private coaching, and tournament rotations.",
    type: FacilityType.BASKETBALL_HALF,
    priceMinor: 120000,
    imageUrl: "https://images.unsplash.com/photo-1519861531473-9200262188bf?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Basketball half court with players"
  },
  {
    slug: "pickleball-court-1",
    name: "Pickleball Court 1",
    description: "Dedicated pickleball court with competition markings and evening lighting.",
    type: FacilityType.PICKLEBALL,
    priceMinor: 90000,
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Outdoor_pickleball_courts.jpg",
    imageAlt: "Outdoor pickleball courts"
  },
  {
    slug: "badminton-court-1",
    name: "Badminton Court 1",
    description: "Indoor badminton lane with rubberized flooring and spectator-side clearance.",
    type: FacilityType.BADMINTON,
    priceMinor: 70000,
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/BOSE_Badminton_Court.jpg",
    imageAlt: "Indoor badminton court"
  },
  {
    slug: "badminton-court-2",
    name: "Badminton Court 2",
    description: "Second badminton court for doubles play, classes, and casual bookings.",
    type: FacilityType.BADMINTON,
    priceMinor: 70000,
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Badminton_courts.jpg",
    imageAlt: "Badminton courts"
  }
] as const;

async function upsertUser(params: {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  phoneVerifiedAt?: Date;
}) {
  return prisma.user.upsert({
    where: { email: params.email },
    update: {
      fullName: params.fullName,
      passwordHash: await bcrypt.hash(params.password, 10),
      phone: params.phone,
      phoneVerifiedAt: params.phoneVerifiedAt,
      role: params.role
    },
    create: {
      email: params.email,
      fullName: params.fullName,
      passwordHash: await bcrypt.hash(params.password, 10),
      phone: params.phone,
      phoneVerifiedAt: params.phoneVerifiedAt,
      role: params.role
    }
  });
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@sportbooking.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin12345!";
  const customerEmail = process.env.SEED_CUSTOMER_EMAIL ?? "player@sportbooking.local";
  const customerPassword = process.env.SEED_CUSTOMER_PASSWORD ?? "Player12345!";

  const admin = await upsertUser({
    email: adminEmail,
    password: adminPassword,
    fullName: "MVP Admin",
    phone: "+639171234567",
    phoneVerifiedAt: new Date(),
    role: UserRole.ADMIN
  });

  const customer = await upsertUser({
    email: customerEmail,
    password: customerPassword,
    fullName: "Sample Player",
    phone: "+639181112222",
    phoneVerifiedAt: new Date(),
    role: UserRole.CUSTOMER
  });

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
            create: [{ url: facility.imageUrl, altText: facility.imageAlt, sortOrder: 0 }]
          },
          operatingHours: {
            deleteMany: {},
            create: defaultOperatingHours
          },
          pricingRules: {
            deleteMany: {},
            create: [
              {
                currency: "PHP",
                amountMinor: facility.priceMinor,
                billingMode: PricingBillingMode.PER_HOUR,
                minimumMinutes: 30,
                isActive: true
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
            create: [{ url: facility.imageUrl, altText: facility.imageAlt, sortOrder: 0 }]
          },
          operatingHours: {
            create: defaultOperatingHours
          },
          pricingRules: {
            create: [
              {
                currency: "PHP",
                amountMinor: facility.priceMinor,
                billingMode: PricingBillingMode.PER_HOUR,
                minimumMinutes: 30,
                isActive: true
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
      status: BookingStatus.PENDING_PAYMENT,
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
      status: BookingStatus.PENDING_PAYMENT,
      startAtUtc: new Date("2026-04-20T08:00:00.000Z"),
      endAtUtc: new Date("2026-04-20T09:00:00.000Z"),
      timezone,
      slotCount: 2,
      amountMinor: 90000,
      currency: "PHP",
      paymentHoldExpiresAt: new Date("2026-04-13T03:15:00.000Z")
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
  console.log(`Admin login: ${adminEmail} / ${adminPassword}`);
  console.log(`Customer login: ${customerEmail} / ${customerPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
