import "dotenv/config";

import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { PrismaClient, UserRole } from "@prisma/client";

import { buildUtcDateFromLocalMinutes } from "@/lib/time/slots";
import { createBookingHold, getFacilityDayAvailability } from "@/server/bookings/service";

const databaseUrl = process.env.DATABASE_URL ?? "";
const databaseHost = databaseUrl ? new URL(databaseUrl).hostname : "";

if (!["localhost", "127.0.0.1", "::1"].includes(databaseHost)) {
  throw new Error("This smoke test is local-only. DATABASE_URL must point to localhost.");
}

const prisma = new PrismaClient();

async function findAvailableSelection() {
  const facilities = await prisma.facility.findMany({
    where: { isEnabled: true },
    include: { operatingHours: true },
    orderBy: { name: "asc" }
  });

  for (let offset = 1; offset <= 45; offset += 1) {
    const dateKey = formatInTimeZone(addDays(new Date(), offset), "Asia/Manila", "yyyy-MM-dd");

    for (const facility of facilities) {
      const availability = await getFacilityDayAvailability(facility, dateKey);
      const selected = availability.slots.find((slot, index) => {
        const nextSlot = availability.slots[index + 1];
        return slot.isAvailable && (
          slot.endMinutes - slot.startMinutes >= 60 ||
          (nextSlot?.isAvailable && nextSlot.endMinutes === slot.endMinutes + 30)
        );
      });

      if (selected) return { facility, dateKey, startMinutes: selected.startMinutes };
    }
  }

  throw new Error("Could not find two consecutive available slots in the next 45 days.");
}

async function main() {
  try {
    const [users, selection] = await Promise.all([
      prisma.user.findMany({ where: { role: UserRole.CUSTOMER }, select: { id: true }, take: 2 }),
      findAvailableSelection()
    ]);

    if (users.length < 2) {
      throw new Error("The local database needs at least two customer users. Run the development seed first.");
    }

    const idempotencyKeys = [
      `uat-concurrency-${crypto.randomUUID()}`,
      `uat-concurrency-${crypto.randomUUID()}`
    ];
    const results = await Promise.allSettled(
      users.map((user, index) => createBookingHold({
        userId: user.id,
        facilityId: selection.facility.id,
        dateKey: selection.dateKey,
        startMinutes: selection.startMinutes,
        durationMinutes: 60,
        idempotencyKey: idempotencyKeys[index]
      }))
    );
    const successfulIds = results.flatMap((result) => result.status === "fulfilled" ? [result.value.id] : []);

    if (successfulIds.length !== 1) {
      throw new Error(`Expected exactly one successful hold, received ${successfulIds.length}.`);
    }

    const persisted = await prisma.booking.count({ where: { id: successfulIds[0] } });
    if (persisted !== 1) throw new Error(`Expected one persisted booking, found ${persisted}.`);

    console.log(`PASS: exactly one hold won for ${selection.facility.name} on ${selection.dateKey}.`);
    await prisma.booking.delete({ where: { id: successfulIds[0] } });

    const blockTitle = `UAT concurrency block ${crypto.randomUUID()}`;
    const startAtUtc = buildUtcDateFromLocalMinutes(selection.dateKey, selection.startMinutes, selection.facility.timezone);
    const endAtUtc = buildUtcDateFromLocalMinutes(selection.dateKey, selection.startMinutes + 60, selection.facility.timezone);
    const bookingKey = `uat-concurrency-${crypto.randomUUID()}`;
    const [bookingResult, blockResult] = await Promise.allSettled([
      createBookingHold({
        userId: users[0].id,
        facilityId: selection.facility.id,
        dateKey: selection.dateKey,
        startMinutes: selection.startMinutes,
        durationMinutes: 60,
        idempotencyKey: bookingKey
      }),
      prisma.blockedSchedule.create({
        data: {
          facilityId: selection.facility.id,
          title: blockTitle,
          reason: "Automated local concurrency test",
          startAtUtc,
          endAtUtc,
          createdByUserId: users[1].id
        }
      })
    ]);
    const competingSuccesses = [bookingResult, blockResult].filter((result) => result.status === "fulfilled").length;

    if (competingSuccesses !== 1) {
      const [persistedBookings, persistedBlocks] = await Promise.all([
        prisma.booking.findMany({ where: { idempotencyKey: bookingKey }, select: { id: true, facilityId: true, startAtUtc: true, endAtUtc: true } }),
        prisma.blockedSchedule.findMany({ where: { title: blockTitle }, select: { id: true, facilityId: true, startAtUtc: true, endAtUtc: true } })
      ]);
      throw new Error(`Expected exactly one booking/block operation to succeed, received ${competingSuccesses}. Persisted bookings: ${persistedBookings.length}; blocks: ${persistedBlocks.length}.`);
    }

    console.log(`PASS: booking and blocked-schedule race produced one valid outcome for ${selection.facility.name}.`);
  } finally {
    await prisma.booking.deleteMany({ where: { idempotencyKey: { startsWith: "uat-concurrency-" } } });
    await prisma.blockedSchedule.deleteMany({ where: { title: { startsWith: "UAT concurrency block " } } });
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Concurrency smoke test failed.");
  process.exitCode = 1;
});
