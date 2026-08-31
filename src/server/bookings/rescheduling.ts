import crypto from "node:crypto";

import {
  BookingRescheduleStatus,
  BookingStatus,
  PaymentProvider,
  PaymentStatus,
  PriceAdjustmentResolution,
  PriceAdjustmentStatus,
  Prisma,
  PricingDayType,
  type PricingRule
} from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/db/prisma";
import { formatCurrency } from "@/lib/formatting/currency";
import { enqueueRescheduleNotification } from "@/lib/notifications/rescheduling";
import { buildUtcDateFromLocalMinutes } from "@/lib/time/slots";
import { formatDateTimeRange } from "@/lib/time/slots";
import { isDateWithinBookingWindow } from "@/server/bookings/booking-window";
import { rangesOverlapByMinute } from "@/server/bookings/core";
import {
  assertLowerPriceResolution,
  assertRescheduleEligibility,
  calculateRescheduleAdjustment
} from "@/server/bookings/rescheduling-policy";
import {
  activeBookingWhere,
  assertAllowedBookingDuration,
  calculateAuthoritativePrice,
  getDailyOpeningRange
} from "@/server/bookings/service";
import { expirePendingReschedules, expireStaleRescheduleHolds } from "@/server/bookings/reschedule-expiration";
import { normalizePaymentReference, type ManualPaymentMethod } from "@/server/payments/service";

const ACTIVE_RESCHEDULE_STATUSES = [
  BookingRescheduleStatus.ADDITIONAL_PAYMENT_REQUIRED,
  BookingRescheduleStatus.PAYMENT_SUBMITTED
] as const;

type ReplacementInput = {
  bookingId: string;
  replacementFacilityId: string;
  dateKey: string;
  startMinutes: number;
};

type InitiateRescheduleInput = ReplacementInput & {
  actorUserId: string;
  reason: string;
  internalNote?: string;
  customerNote?: string;
  waivedAmountMinor?: number;
  canOverrideAdjustment: boolean;
  idempotencyKey: string;
};

function integerSetting(value: Prisma.JsonValue | null | undefined, environmentValue: string | undefined, fallback: number) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  const parsed = Number.parseInt(environmentValue ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function defaultPricingRule(rules: PricingRule[]) {
  const rule = rules.find((item) => item.isActive && item.dayType === PricingDayType.DEFAULT);
  if (!rule) throw new Error("Facility default pricing is not configured.");
  return rule;
}

function rescheduleReference() {
  return `PG-RS-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

async function lockFacilities(tx: Prisma.TransactionClient, facilityIds: string[]) {
  for (const facilityId of [...new Set(facilityIds)].sort()) {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${facilityId}))`);
  }
}

async function loadEligibleBooking(tx: Prisma.TransactionClient, bookingId: string, now: Date) {
  await expireStaleRescheduleHolds(tx, { now });
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`);
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    include: {
      payment: true,
      bookingOrder: { include: { payment: true } },
      facility: true,
      reschedules: {
        where: { status: { in: [...ACTIVE_RESCHEDULE_STATUSES] } },
        select: { id: true }
      }
    }
  });

  if (!booking) throw new Error("Booking was not found.");
  const cutoffSetting = await tx.appSetting.findUnique({ where: { key: "booking.rescheduleCutoffHours" } });
  const cutoffHours = integerSetting(cutoffSetting?.value, process.env.RESCHEDULE_CUTOFF_HOURS, 24);
  const originalPayment = booking.payment ?? booking.bookingOrder?.payment ?? null;
  assertRescheduleEligibility({
    bookingStatus: booking.status,
    paymentStatus: originalPayment?.status ?? null,
    startAtUtc: booking.startAtUtc,
    now,
    cutoffHours,
    activeRequestCount: booking.reschedules.length
  });

  return booking;
}

async function calculateReplacement(tx: Prisma.TransactionClient, booking: Awaited<ReturnType<typeof loadEligibleBooking>>, input: ReplacementInput, now: Date) {
  await expireStaleRescheduleHolds(tx, {
    now,
    replacementFacilityId: input.replacementFacilityId
  });
  const facility = await tx.facility.findUnique({
    where: { id: input.replacementFacilityId },
    include: {
      operatingHours: true,
      pricingRules: { where: { isActive: true }, orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] }
    }
  });
  if (!facility || !facility.isEnabled) throw new Error("The replacement facility is not available.");

  const durationMinutes = Math.round((booking.endAtUtc.getTime() - booking.startAtUtc.getTime()) / 60_000);
  assertAllowedBookingDuration(durationMinutes, defaultPricingRule(facility.pricingRules).minimumMinutes, facility.slotIntervalMinutes);
  if (!isDateWithinBookingWindow(input.dateKey, facility.timezone, now)) {
    throw new Error("The replacement date is outside the current booking window.");
  }

  const openingRange = getDailyOpeningRange(facility, input.dateKey);
  if (!openingRange) throw new Error("The replacement facility is closed on the selected date.");
  const replacementRange = { startMinutes: input.startMinutes, endMinutes: input.startMinutes + durationMinutes };
  if (!rangesOverlapByMinute(replacementRange, openingRange) || replacementRange.endMinutes > openingRange.endMinutes) {
    throw new Error("The replacement schedule is outside operating hours.");
  }

  const startAtUtc = buildUtcDateFromLocalMinutes(input.dateKey, input.startMinutes, facility.timezone);
  const endAtUtc = buildUtcDateFromLocalMinutes(input.dateKey, replacementRange.endMinutes, facility.timezone);
  if (startAtUtc <= now) throw new Error("The replacement schedule must be in the future.");
  if (booking.facilityId === facility.id && booking.startAtUtc.getTime() === startAtUtc.getTime() && booking.endAtUtc.getTime() === endAtUtc.getTime()) {
    throw new Error("Choose a different facility, date, or time before rescheduling.");
  }

  const [conflictingBooking, conflictingHold, blockedSchedule] = await Promise.all([
    tx.booking.findFirst({
      where: {
        id: { not: booking.id },
        facilityId: facility.id,
        ...activeBookingWhere(now),
        startAtUtc: { lt: endAtUtc },
        endAtUtc: { gt: startAtUtc }
      },
      select: { id: true }
    }),
    tx.bookingReschedule.findFirst({
      where: {
        bookingId: { not: booking.id },
        replacementFacilityId: facility.id,
        OR: [
          { status: BookingRescheduleStatus.PAYMENT_SUBMITTED },
          { status: BookingRescheduleStatus.ADDITIONAL_PAYMENT_REQUIRED, holdExpiresAt: { gt: now } }
        ],
        replacementStartAtUtc: { lt: endAtUtc },
        replacementEndAtUtc: { gt: startAtUtc }
      },
      select: { id: true }
    }),
    tx.blockedSchedule.findFirst({
      where: {
        facilityId: facility.id,
        startAtUtc: { lt: endAtUtc },
        endAtUtc: { gt: startAtUtc }
      },
      select: { id: true }
    })
  ]);
  if (conflictingBooking || conflictingHold || blockedSchedule) throw new Error("The replacement schedule is no longer available.");

  const price = await calculateAuthoritativePrice({
    tx,
    facilityId: facility.id,
    timezone: facility.timezone,
    slotIntervalMinutes: facility.slotIntervalMinutes,
    dateKey: input.dateKey,
    startMinutes: input.startMinutes,
    durationMinutes,
    rules: facility.pricingRules,
    calculatedAt: now
  });

  return { facility, durationMinutes, startAtUtc, endAtUtc, price };
}

export async function previewBookingReschedule(input: ReplacementInput) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const booking = await loadEligibleBooking(tx, input.bookingId, now);
    await lockFacilities(tx, [booking.facilityId, input.replacementFacilityId]);
    const replacement = await calculateReplacement(tx, booking, input, now);
    return {
      booking,
      replacement,
      originalAmountMinor: booking.amountMinor,
      replacementAmountMinor: replacement.price.amountMinor,
      priceDifferenceMinor: replacement.price.amountMinor - booking.amountMinor
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 });
}

export async function initiateBookingReschedule(input: InitiateRescheduleInput) {
  const now = new Date();
  const existing = await prisma.bookingReschedule.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { additionalPayment: true } });
  if (existing) {
    if (existing.bookingId !== input.bookingId || existing.initiatedByUserId !== input.actorUserId) throw new Error("This reschedule request cannot be reused.");
    return existing;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const booking = await loadEligibleBooking(tx, input.bookingId, now);
      await lockFacilities(tx, [booking.facilityId, input.replacementFacilityId]);
      const replacement = await calculateReplacement(tx, booking, input, now);
      const requestedWaiver = Math.max(0, input.waivedAmountMinor ?? 0);
      const adjustment = calculateRescheduleAdjustment({
        originalAmountMinor: booking.amountMinor,
        replacementAmountMinor: replacement.price.amountMinor,
        waivedAmountMinor: requestedWaiver,
        canOverrideAdjustment: input.canOverrideAdjustment,
        hasCustomerNote: Boolean(input.customerNote?.trim())
      });
      const {
        differenceMinor,
        adjustmentType,
        additionalAmountDueMinor,
        requiresAdditionalPayment,
        status,
        adjustmentStatus
      } = adjustment;
      const holdSetting = requiresAdditionalPayment ? await tx.appSetting.findUnique({ where: { key: "booking.rescheduleHoldMinutes" } }) : null;
      const holdMinutes = integerSetting(holdSetting?.value, process.env.RESCHEDULE_PAYMENT_HOLD_MINUTES, 15);
      const holdExpiresAt = requiresAdditionalPayment ? new Date(now.getTime() + holdMinutes * 60_000) : null;
      const originalPayment = booking.payment ?? booking.bookingOrder?.payment ?? null;
      const originalBookingReference = booking.reference ?? originalPayment?.providerReference ?? `BOOK-${booking.id.slice(0, 8).toUpperCase()}`;

      const reschedule = await tx.bookingReschedule.create({
        data: {
          bookingId: booking.id,
          originalPaymentId: originalPayment?.id,
          originalBookingReference,
          originalFacilityId: booking.facilityId,
          originalStartAtUtc: booking.startAtUtc,
          originalEndAtUtc: booking.endAtUtc,
          originalTimezone: booking.timezone,
          replacementFacilityId: replacement.facility.id,
          replacementStartAtUtc: replacement.startAtUtc,
          replacementEndAtUtc: replacement.endAtUtc,
          replacementTimezone: replacement.facility.timezone,
          originalPriceSnapshot: booking.priceSnapshot ?? Prisma.JsonNull,
          replacementPriceSnapshot: replacement.price as unknown as Prisma.InputJsonValue,
          originalAmountMinor: booking.amountMinor,
          replacementAmountMinor: replacement.price.amountMinor,
          priceDifferenceMinor: differenceMinor,
          waivedAmountMinor: requestedWaiver,
          additionalAmountDueMinor,
          currency: replacement.price.currency,
          status,
          adjustmentType,
          adjustmentStatus,
          holdExpiresAt,
          reason: input.reason.trim(),
          internalNote: input.internalNote?.trim() || null,
          customerNote: input.customerNote?.trim() || null,
          resolutionMethod: requestedWaiver > 0 && !requiresAdditionalPayment ? PriceAdjustmentResolution.WAIVER : null,
          resolutionAmountMinor: requestedWaiver > 0 && !requiresAdditionalPayment ? requestedWaiver : null,
          resolutionNote: requestedWaiver > 0 && !requiresAdditionalPayment ? input.reason.trim() : null,
          initiatedByUserId: input.actorUserId,
          finalizedByUserId: requiresAdditionalPayment ? null : input.actorUserId,
          resolvedByUserId: requestedWaiver > 0 && !requiresAdditionalPayment ? input.actorUserId : null,
          idempotencyKey: input.idempotencyKey,
          finalizedAt: requiresAdditionalPayment ? null : now,
          resolvedAt: requestedWaiver > 0 && !requiresAdditionalPayment ? now : null,
          additionalPayment: requiresAdditionalPayment ? {
            create: {
              provider: PaymentProvider.MANUAL,
              providerReference: rescheduleReference(),
              method: "manual_gcash",
              amountMinor: additionalAmountDueMinor,
              currency: replacement.price.currency,
              status: PaymentStatus.AWAITING_PAYMENT
            }
          } : undefined
        },
        include: { additionalPayment: true }
      });

      if (!requiresAdditionalPayment) {
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            facilityId: replacement.facility.id,
            startAtUtc: replacement.startAtUtc,
            endAtUtc: replacement.endAtUtc,
            timezone: replacement.facility.timezone,
            slotCount: replacement.durationMinutes / replacement.facility.slotIntervalMinutes,
            amountMinor: replacement.price.amountMinor,
            currency: replacement.price.currency,
            priceSnapshot: replacement.price as unknown as Prisma.InputJsonValue
          }
        });
      }

      await writeAuditLog(tx, {
        actorUserId: input.actorUserId,
        action: requiresAdditionalPayment ? "booking.reschedule.additional_payment_requested" : "booking.reschedule.completed",
        entityType: "BookingReschedule",
        entityId: reschedule.id,
        before: { facilityId: booking.facilityId, startAtUtc: booking.startAtUtc.toISOString(), endAtUtc: booking.endAtUtc.toISOString(), amountMinor: booking.amountMinor },
        after: { facilityId: replacement.facility.id, startAtUtc: replacement.startAtUtc.toISOString(), endAtUtc: replacement.endAtUtc.toISOString(), amountMinor: replacement.price.amountMinor, status, adjustmentStatus },
        metadata: { bookingId: booking.id, reason: input.reason.trim(), waivedAmountMinor: requestedWaiver, holdExpiresAt: holdExpiresAt?.toISOString() ?? null }
      });
      if (requestedWaiver > 0) {
        await writeAuditLog(tx, {
          actorUserId: input.actorUserId,
          action: "booking.reschedule.adjustment_waived",
          entityType: "BookingReschedule",
          entityId: reschedule.id,
          before: { additionalAmountMinor: differenceMinor },
          after: {
            waivedAmountMinor: requestedWaiver,
            additionalAmountDueMinor
          },
          metadata: {
            bookingId: booking.id,
            reason: input.reason.trim(),
            customerNote: input.customerNote?.trim()
          }
        });
      }
      await enqueueRescheduleNotification(tx, {
        dedupeKey: `${reschedule.id}:${requiresAdditionalPayment ? "additional-payment-requested" : "completed"}`,
        userId: booking.userId,
        bookingId: booking.id,
        rescheduleId: reschedule.id,
        eventType: requiresAdditionalPayment ? "RESCHEDULE_ADDITIONAL_PAYMENT_REQUESTED" : "RESCHEDULE_COMPLETED",
        payload: {
          subject: requiresAdditionalPayment ? `Additional payment required for booking ${originalBookingReference}` : `Booking ${originalBookingReference} rescheduled`,
          heading: requiresAdditionalPayment ? "Replacement slot held - additional payment required" : "Your booking has been rescheduled",
          lines: [
            `Booking reference: ${originalBookingReference}`,
            `Previous schedule: ${booking.facility.name}, ${formatDateTimeRange(booking.startAtUtc, booking.endAtUtc, booking.timezone)}`,
            `New schedule: ${replacement.facility.name}, ${formatDateTimeRange(replacement.startAtUtc, replacement.endAtUtc, replacement.facility.timezone)}`,
            `Original paid base amount: ${formatCurrency(booking.amountMinor, "PHP")}`,
            `New VAT-exclusive base amount: ${formatCurrency(replacement.price.amountMinor, "PHP")}`,
            requiresAdditionalPayment ? `Additional amount due: ${formatCurrency(additionalAmountDueMinor, "PHP")}. Payment deadline: ${holdExpiresAt?.toISOString()}.` : differenceMinor < 0 ? `Potential refund or customer credit: ${formatCurrency(Math.abs(differenceMinor), "PHP")}. Staff will resolve this manually.` : "No additional payment is required.",
            input.customerNote?.trim() || `Reason: ${input.reason.trim()}`
          ]
        }
      });

      return reschedule;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const reusable = await prisma.bookingReschedule.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { additionalPayment: true } });
      if (reusable?.bookingId === input.bookingId && reusable.initiatedByUserId === input.actorUserId) return reusable;
    }
    throw error;
  }
}

export async function submitReschedulePaymentProof(input: {
  rescheduleId: string;
  userId: string;
  method: ManualPaymentMethod;
  externalReference: string;
  proofImageUrl: string;
}) {
  const now = new Date();
  const normalizedReference = normalizePaymentReference(input.externalReference);
  return prisma.$transaction(async (tx) => {
    const reschedule = await tx.bookingReschedule.findFirst({
      where: { id: input.rescheduleId, booking: { userId: input.userId } },
      include: { additionalPayment: true, booking: { select: { userId: true } }, originalFacility: { select: { name: true } }, replacementFacility: { select: { name: true } } }
    });
    if (!reschedule?.additionalPayment) throw new Error("Additional payment request was not found.");
    if (reschedule.status !== BookingRescheduleStatus.ADDITIONAL_PAYMENT_REQUIRED || reschedule.additionalPayment.status !== PaymentStatus.AWAITING_PAYMENT) {
      throw new Error("Payment proof cannot be submitted for this reschedule state.");
    }
    if (!reschedule.holdExpiresAt || reschedule.holdExpiresAt <= now) throw new Error("The replacement-slot hold has expired. The original booking remains valid.");

    const [duplicateBookingPayment, duplicateReschedulePayment] = await Promise.all([
      tx.payment.findFirst({ where: { normalizedExternalReference: normalizedReference, status: { in: [PaymentStatus.SUBMITTED, PaymentStatus.VERIFIED, PaymentStatus.ACTION_REQUIRED] } }, select: { id: true } }),
      tx.reschedulePayment.findFirst({ where: { id: { not: reschedule.additionalPayment.id }, normalizedExternalReference: normalizedReference, status: { in: [PaymentStatus.SUBMITTED, PaymentStatus.VERIFIED, PaymentStatus.ACTION_REQUIRED] } }, select: { id: true } })
    ]);
    if (duplicateBookingPayment || duplicateReschedulePayment) throw new Error("This payment reference is already associated with another submitted payment.");

    await tx.reschedulePayment.update({
      where: { id: reschedule.additionalPayment.id },
      data: {
        method: input.method,
        externalReference: input.externalReference.trim(),
        normalizedExternalReference: normalizedReference,
        proofImageUrl: input.proofImageUrl,
        status: PaymentStatus.SUBMITTED,
        submittedAt: now,
        reviewNote: null,
        rejectedAt: null
      }
    });
    const updated = await tx.bookingReschedule.update({
      where: { id: reschedule.id },
      data: { status: BookingRescheduleStatus.PAYMENT_SUBMITTED, adjustmentStatus: PriceAdjustmentStatus.SUBMITTED, holdExpiresAt: null, version: { increment: 1 } }
    });
    await writeAuditLog(tx, { actorUserId: input.userId, action: "booking.reschedule.payment_submitted", entityType: "BookingReschedule", entityId: reschedule.id, metadata: { bookingId: reschedule.bookingId, paymentId: reschedule.additionalPayment.id } });
    await enqueueRescheduleNotification(tx, { dedupeKey: `${reschedule.id}:payment-submitted`, userId: reschedule.booking.userId, bookingId: reschedule.bookingId, rescheduleId: reschedule.id, eventType: "RESCHEDULE_PAYMENT_SUBMITTED", payload: { subject: `Additional payment proof received for ${reschedule.originalBookingReference}`, heading: "Additional payment submitted for verification", lines: [`Booking reference: ${reschedule.originalBookingReference}`, `Replacement: ${reschedule.replacementFacility.name}, ${formatDateTimeRange(reschedule.replacementStartAtUtc, reschedule.replacementEndAtUtc, reschedule.replacementTimezone)}`, `Additional amount: ${formatCurrency(reschedule.additionalAmountDueMinor, "PHP")}`, "Your original booking remains confirmed while staff reviews the proof."] } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 });
}

export async function verifyReschedulePayment(input: { reschedulePaymentId: string; adminUserId: string; reviewNote?: string }) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const payment = await tx.reschedulePayment.findUnique({ where: { id: input.reschedulePaymentId }, include: { bookingReschedule: { include: { booking: true, originalFacility: { select: { name: true } }, replacementFacility: { select: { name: true, slotIntervalMinutes: true } } } } } });
    if (!payment || payment.status !== PaymentStatus.SUBMITTED || payment.bookingReschedule.status !== BookingRescheduleStatus.PAYMENT_SUBMITTED) {
      throw new Error("Only submitted reschedule payments can be verified.");
    }
    const reschedule = payment.bookingReschedule;
    await lockFacilities(tx, [reschedule.booking.facilityId, reschedule.replacementFacilityId]);
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${reschedule.bookingId} FOR UPDATE`);
    if (reschedule.booking.status !== BookingStatus.CONFIRMED) throw new Error("The original booking is no longer confirmed.");

    await tx.booking.update({
      where: { id: reschedule.bookingId },
      data: {
        facilityId: reschedule.replacementFacilityId,
        startAtUtc: reschedule.replacementStartAtUtc,
        endAtUtc: reschedule.replacementEndAtUtc,
        timezone: reschedule.replacementTimezone,
        slotCount: Math.round((reschedule.replacementEndAtUtc.getTime() - reschedule.replacementStartAtUtc.getTime()) / 60_000) / reschedule.replacementFacility.slotIntervalMinutes,
        amountMinor: reschedule.replacementAmountMinor,
        currency: reschedule.currency,
        priceSnapshot: reschedule.replacementPriceSnapshot as Prisma.InputJsonValue
      }
    });
    await tx.reschedulePayment.update({ where: { id: payment.id }, data: { status: PaymentStatus.VERIFIED, verifiedAt: now, verifiedByUserId: input.adminUserId, reviewNote: input.reviewNote?.trim() || null } });
    const updated = await tx.bookingReschedule.update({
      where: { id: reschedule.id },
      data: { status: BookingRescheduleStatus.COMPLETED, adjustmentStatus: PriceAdjustmentStatus.RESOLVED, finalizedAt: now, finalizedByUserId: input.adminUserId, resolvedAt: now, resolvedByUserId: input.adminUserId, version: { increment: 1 } }
    });
    await writeAuditLog(tx, { actorUserId: input.adminUserId, action: "booking.reschedule.payment_verified", entityType: "BookingReschedule", entityId: reschedule.id, after: { bookingId: reschedule.bookingId, facilityId: reschedule.replacementFacilityId, startAtUtc: reschedule.replacementStartAtUtc.toISOString(), amountMinor: reschedule.replacementAmountMinor } });
    await enqueueRescheduleNotification(tx, { dedupeKey: `${reschedule.id}:payment-verified`, userId: reschedule.booking.userId, bookingId: reschedule.bookingId, rescheduleId: reschedule.id, eventType: "RESCHEDULE_PAYMENT_VERIFIED", payload: { subject: `Booking ${reschedule.originalBookingReference} rescheduled`, heading: "Additional payment verified - reschedule complete", lines: [`Booking reference: ${reschedule.originalBookingReference}`, `Previous schedule: ${reschedule.originalFacility.name}, ${formatDateTimeRange(reschedule.originalStartAtUtc, reschedule.originalEndAtUtc, reschedule.originalTimezone)}`, `Current schedule: ${reschedule.replacementFacility.name}, ${formatDateTimeRange(reschedule.replacementStartAtUtc, reschedule.replacementEndAtUtc, reschedule.replacementTimezone)}`, `New VAT-exclusive base amount: ${formatCurrency(reschedule.replacementAmountMinor, "PHP")}`] } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 });
}

export async function rejectReschedulePayment(input: { reschedulePaymentId: string; adminUserId: string; reviewNote: string }) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const payment = await tx.reschedulePayment.findUnique({ where: { id: input.reschedulePaymentId }, include: { bookingReschedule: { include: { booking: { select: { userId: true } } } } } });
    if (!payment || payment.status !== PaymentStatus.SUBMITTED || payment.bookingReschedule.status !== BookingRescheduleStatus.PAYMENT_SUBMITTED) {
      throw new Error("Only submitted reschedule payments can be rejected.");
    }
    await tx.reschedulePayment.update({ where: { id: payment.id }, data: { status: PaymentStatus.REJECTED, rejectedAt: now, verifiedByUserId: input.adminUserId, reviewNote: input.reviewNote.trim() } });
    const updated = await tx.bookingReschedule.update({ where: { id: payment.bookingRescheduleId }, data: { status: BookingRescheduleStatus.REJECTED, adjustmentStatus: PriceAdjustmentStatus.REJECTED, rejectedAt: now, holdExpiresAt: null, version: { increment: 1 } } });
    await writeAuditLog(tx, { actorUserId: input.adminUserId, action: "booking.reschedule.payment_rejected", entityType: "BookingReschedule", entityId: payment.bookingRescheduleId, metadata: { bookingId: payment.bookingReschedule.bookingId, reason: input.reviewNote.trim() } });
    await enqueueRescheduleNotification(tx, { dedupeKey: `${payment.bookingRescheduleId}:payment-rejected`, userId: payment.bookingReschedule.booking.userId, bookingId: payment.bookingReschedule.bookingId, rescheduleId: payment.bookingRescheduleId, eventType: "RESCHEDULE_PAYMENT_REJECTED", payload: { subject: `Reschedule payment rejected for ${payment.bookingReschedule.originalBookingReference}`, heading: "Additional payment proof was not accepted", lines: [`Booking reference: ${payment.bookingReschedule.originalBookingReference}`, input.reviewNote.trim(), "The replacement hold has been released. Your original confirmed booking remains valid."] } });
    return updated;
  });
}

export async function resolveLowerPriceAdjustment(input: {
  rescheduleId: string;
  adminUserId: string;
  method: Exclude<PriceAdjustmentResolution, "WAIVER">;
  amountMinor: number;
  reference?: string;
  note: string;
}) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const reschedule = await tx.bookingReschedule.findUnique({ where: { id: input.rescheduleId }, include: { booking: { select: { userId: true } } } });
    if (!reschedule || reschedule.status !== BookingRescheduleStatus.COMPLETED || reschedule.adjustmentStatus !== PriceAdjustmentStatus.UNRESOLVED || reschedule.priceDifferenceMinor >= 0) {
      throw new Error("This reschedule does not have an unresolved lower-price adjustment.");
    }
    assertLowerPriceResolution({
      priceDifferenceMinor: reschedule.priceDifferenceMinor,
      method: input.method,
      amountMinor: input.amountMinor
    });
    const updated = await tx.bookingReschedule.update({
      where: { id: reschedule.id },
      data: { adjustmentStatus: PriceAdjustmentStatus.RESOLVED, resolutionMethod: input.method, resolutionAmountMinor: input.amountMinor, resolutionReference: input.reference?.trim() || null, resolutionNote: input.note.trim(), resolvedAt: now, resolvedByUserId: input.adminUserId, version: { increment: 1 } }
    });
    await writeAuditLog(tx, { actorUserId: input.adminUserId, action: "booking.reschedule.adjustment_resolved", entityType: "BookingReschedule", entityId: reschedule.id, after: { method: input.method, amountMinor: input.amountMinor, reference: input.reference?.trim() || null }, metadata: { bookingId: reschedule.bookingId } });
    await enqueueRescheduleNotification(tx, { dedupeKey: `${reschedule.id}:adjustment-resolved`, userId: reschedule.booking.userId, bookingId: reschedule.bookingId, rescheduleId: reschedule.id, eventType: "RESCHEDULE_ADJUSTMENT_RESOLVED", payload: { subject: `Price adjustment resolved for ${reschedule.originalBookingReference}`, heading: "Your rescheduling price adjustment was resolved", lines: [`Booking reference: ${reschedule.originalBookingReference}`, `Resolution: ${input.method.replaceAll("_", " ")}`, `Amount: ${formatCurrency(input.amountMinor, "PHP")}`, input.note.trim()] } });
    return updated;
  });
}

export { ACTIVE_RESCHEDULE_STATUSES, expirePendingReschedules };
