import crypto from "node:crypto";

import {
  BookingOrderStatus,
  BookingStatus,
  CartStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma
} from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/db/prisma";
import { formatCurrency } from "@/lib/formatting/currency";
import { enqueueOrderNotification } from "@/lib/notifications/orders";
import { formatDateTimeRange } from "@/lib/time/slots";
import { validateAndPriceBookingSelection, type BookingSelectionInput } from "@/server/bookings/selection";
import { expireStaleOrdersInTransaction } from "@/server/orders/expiration";

const CART_LIFETIME_DAYS = 7;

export type CartItemAvailability = "AVAILABLE" | "UNAVAILABLE";

function cartExpiry(now: Date) {
  const configured = Number.parseInt(process.env.CART_EXPIRY_DAYS ?? String(CART_LIFETIME_DAYS), 10);
  const days = Number.isInteger(configured) && configured > 0 ? configured : CART_LIFETIME_DAYS;
  return new Date(now.getTime() + days * 24 * 60 * 60_000);
}

function paymentHoldMinutes(value: Prisma.JsonValue | null | undefined) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  const configured = Number.parseInt(process.env.PAYMENT_HOLD_MINUTES ?? "15", 10);
  return Number.isInteger(configured) && configured > 0 ? configured : 15;
}

function orderReference() {
  return `PG-OR-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
}

function bookingReference() {
  return `PG-BK-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
}

async function advisoryLock(tx: Prisma.TransactionClient, key: string) {
  await tx.$queryRaw<Array<{ lock: string }>>(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${key}))::text AS "lock"`
  );
}

async function getOrCreateActiveCart(tx: Prisma.TransactionClient, userId: string, now: Date) {
  await advisoryLock(tx, `cart:${userId}`);

  const active = await tx.cart.findFirst({ where: { userId, status: CartStatus.ACTIVE } });
  if (active && (!active.expiresAt || active.expiresAt > now)) return active;

  if (active) {
    await tx.cart.update({ where: { id: active.id }, data: { status: CartStatus.EXPIRED, version: { increment: 1 } } });
  }

  return tx.cart.create({
    data: {
      userId,
      status: CartStatus.ACTIVE,
      currency: "PHP",
      lastActivityAt: now,
      expiresAt: cartExpiry(now)
    }
  });
}

async function touchCart(tx: Prisma.TransactionClient, cartId: string, now: Date) {
  await tx.cart.update({
    where: { id: cartId },
    data: { lastActivityAt: now, expiresAt: cartExpiry(now), version: { increment: 1 } }
  });
}

export async function getActiveCartCount(userId: string) {
  return prisma.cartItem.count({
    where: {
      cart: {
        userId,
        status: CartStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      }
    }
  });
}

export async function addCartItem(userId: string, input: BookingSelectionInput) {
  const now = new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const cart = await getOrCreateActiveCart(tx, userId, now);
      const selection = await validateAndPriceBookingSelection(tx, input, now);
      const item = await tx.cartItem.create({
        data: {
          cartId: cart.id,
          facilityId: selection.facility.id,
          dateKey: input.dateKey,
          startAtUtc: selection.startAtUtc,
          endAtUtc: selection.endAtUtc,
          timezone: selection.facility.timezone,
          durationMinutes: selection.durationMinutes,
          quotedAmountMinor: selection.price.amountMinor,
          currency: selection.price.currency,
          quotedPricePreview: selection.price as unknown as Prisma.InputJsonValue,
          quoteCalculatedAt: now
        }
      });
      await touchCart(tx, cart.id, now);
      return item;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("This exact schedule is already in your cart.");
    }
    throw error;
  }
}

export async function replaceCartItem(userId: string, cartItemId: string, input: BookingSelectionInput) {
  const now = new Date();
  try {
    return await prisma.$transaction(async (tx) => {
      await advisoryLock(tx, `cart:${userId}`);
      const item = await tx.cartItem.findFirst({
        where: { id: cartItemId, cart: { userId, status: CartStatus.ACTIVE } },
        include: { cart: true }
      });
      if (!item || (item.cart.expiresAt && item.cart.expiresAt <= now)) throw new Error("Cart item was not found or has expired.");
      const selection = await validateAndPriceBookingSelection(tx, input, now);
      const updated = await tx.cartItem.update({
        where: { id: item.id },
        data: {
          facilityId: selection.facility.id,
          dateKey: input.dateKey,
          startAtUtc: selection.startAtUtc,
          endAtUtc: selection.endAtUtc,
          timezone: selection.facility.timezone,
          durationMinutes: selection.durationMinutes,
          quotedAmountMinor: selection.price.amountMinor,
          currency: selection.price.currency,
          quotedPricePreview: selection.price as unknown as Prisma.InputJsonValue,
          quoteCalculatedAt: now,
          version: { increment: 1 }
        }
      });
      await touchCart(tx, item.cartId, now);
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("This exact schedule is already in your cart.");
    }
    throw error;
  }
}

export async function removeCartItem(userId: string, cartItemId: string) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.cartItem.findFirst({
      where: { id: cartItemId, cart: { userId, status: CartStatus.ACTIVE } },
      select: { id: true, cartId: true }
    });
    if (!item) throw new Error("Cart item was not found.");
    await tx.cartItem.delete({ where: { id: item.id } });
    await touchCart(tx, item.cartId, new Date());
  });
}

export async function clearActiveCart(userId: string) {
  return prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findFirst({ where: { userId, status: CartStatus.ACTIVE }, select: { id: true } });
    if (!cart) return;
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    await touchCart(tx, cart.id, new Date());
  });
}

async function evaluateCartItems(tx: Prisma.TransactionClient, userId: string, now: Date) {
  const cart = await tx.cart.findFirst({
    where: { userId, status: CartStatus.ACTIVE },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: { facility: { include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } } }
      }
    }
  });
  if (!cart || (cart.expiresAt && cart.expiresAt <= now)) return null;

  const evaluated = await Promise.all(cart.items.map(async (item) => {
    try {
      const selection = await validateAndPriceBookingSelection(tx, {
        facilityId: item.facilityId,
        dateKey: item.dateKey,
        startMinutes: getLocalStartMinutes(item.startAtUtc, item.dateKey, item.timezone),
        durationMinutes: item.durationMinutes
      }, now);
      return {
        ...item,
        currentPrice: selection.price,
        currentAmountMinor: selection.price.amountMinor,
        priceChanged: selection.price.amountMinor !== item.quotedAmountMinor,
        availability: "AVAILABLE" as const,
        availabilityMessage: null
      };
    } catch (error) {
      return {
        ...item,
        currentPrice: null,
        currentAmountMinor: item.quotedAmountMinor,
        priceChanged: false,
        availability: "UNAVAILABLE" as const,
        availabilityMessage: error instanceof Error ? error.message : "This schedule is unavailable."
      };
    }
  }));

  return { ...cart, items: evaluated };
}

function getLocalStartMinutes(value: Date, dateKey: string, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = Object.fromEntries(formatter.formatToParts(value).map((part) => [part.type, part.value]));
  const renderedDate = `${parts.year}-${parts.month}-${parts.day}`;
  if (renderedDate !== dateKey) throw new Error("Cart schedule date is invalid.");
  return Number(parts.hour) * 60 + Number(parts.minute);
}

export async function getActiveCart(userId: string) {
  return prisma.$transaction((tx) => evaluateCartItems(tx, userId, new Date()));
}

export async function acknowledgeCurrentCartPrices(userId: string) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const cart = await evaluateCartItems(tx, userId, now);
    if (!cart || cart.items.length === 0) throw new Error("Your cart is empty.");
    const unavailable = cart.items.find((item) => item.availability === "UNAVAILABLE");
    if (unavailable) throw new Error(`${unavailable.facility.name}: ${unavailable.availabilityMessage}`);

    for (const item of cart.items) {
      if (!item.currentPrice) continue;
      await tx.cartItem.update({
        where: { id: item.id },
        data: {
          quotedAmountMinor: item.currentPrice.amountMinor,
          currency: item.currentPrice.currency,
          quotedPricePreview: item.currentPrice as unknown as Prisma.InputJsonValue,
          quoteCalculatedAt: now,
          version: { increment: 1 }
        }
      });
    }
    await touchCart(tx, cart.id, now);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 });
}

export function assertNoOverlappingCartItems(items: Array<{ facilityId: string; startAtUtc: Date; endAtUtc: Date }>) {
  for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
      const left = items[leftIndex];
      const right = items[rightIndex];
      if (left.facilityId === right.facilityId && left.startAtUtc < right.endAtUtc && left.endAtUtc > right.startAtUtc) {
        throw new Error("Your cart contains overlapping schedules for the same facility.");
      }
    }
  }
}

export async function checkoutActiveCart(input: { userId: string; idempotencyKey: string }) {
  const now = new Date();

  await writeAuditLog(prisma, {
    actorUserId: input.userId,
    action: "booking_order.checkout_attempted",
    entityType: "CartCheckout",
    entityId: input.idempotencyKey,
    metadata: { idempotencyKey: input.idempotencyKey }
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const reusable = await tx.bookingOrder.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { payment: true, bookings: true }
      });
      if (reusable) {
        if (reusable.userId !== input.userId) throw new Error("Checkout request could not be reused.");
        return reusable;
      }

      await advisoryLock(tx, `cart:${input.userId}`);
      const cart = await tx.cart.findFirst({
        where: { userId: input.userId, status: CartStatus.ACTIVE },
        include: { items: { orderBy: { createdAt: "asc" } } }
      });
      if (!cart || cart.items.length === 0) throw new Error("Your cart is empty.");
      if (cart.expiresAt && cart.expiresAt <= now) throw new Error("Your cart has expired. Please create a new cart.");
      assertNoOverlappingCartItems(cart.items);

      for (const facilityId of [...new Set(cart.items.map((item) => item.facilityId))].sort()) {
        await advisoryLock(tx, `facility:${facilityId}`);
      }

      const facilityIds = [...new Set(cart.items.map((item) => item.facilityId))];
      await expireStaleOrdersInTransaction(tx, { now, facilityIds });

      const holdSetting = await tx.appSetting.findUnique({ where: { key: "booking.paymentHoldMinutes" } });
      const holdExpiresAt = new Date(now.getTime() + paymentHoldMinutes(holdSetting?.value) * 60_000);
      const selections = [];
      for (const item of cart.items) {
        const selection = await validateAndPriceBookingSelection(tx, {
          facilityId: item.facilityId,
          dateKey: item.dateKey,
          startMinutes: getLocalStartMinutes(item.startAtUtc, item.dateKey, item.timezone),
          durationMinutes: item.durationMinutes
        }, now);
        if (selection.price.amountMinor !== item.quotedAmountMinor) {
          throw new Error("One or more prices changed. Review and accept the updated cart prices before checkout.");
        }
        selections.push({ item, selection });
      }

      const reference = orderReference();
      const baseAmountMinor = selections.reduce((sum, entry) => sum + entry.selection.price.amountMinor, 0);
      const checkoutSnapshot = {
        version: 1,
        vatTreatment: "VAT_EXCLUSIVE",
        calculatedAt: now.toISOString(),
        currency: "PHP",
        baseAmountMinor,
        items: selections.map(({ item, selection }, index) => ({
          sequence: index + 1,
          cartItemId: item.id,
          facilityId: selection.facility.id,
          facilityName: selection.facility.name,
          startAtUtc: selection.startAtUtc.toISOString(),
          endAtUtc: selection.endAtUtc.toISOString(),
          timezone: selection.facility.timezone,
          amountMinor: selection.price.amountMinor,
          priceSnapshot: selection.price
        }))
      };

      const order = await tx.bookingOrder.create({
        data: {
          userId: input.userId,
          cartId: cart.id,
          reference,
          status: BookingOrderStatus.PENDING_PAYMENT,
          currency: "PHP",
          vatTreatment: "VAT_EXCLUSIVE",
          baseAmountMinor,
          outstandingAmountMinor: baseAmountMinor,
          checkoutSnapshot: checkoutSnapshot as unknown as Prisma.InputJsonValue,
          checkoutAt: now,
          paymentDeadline: holdExpiresAt,
          idempotencyKey: input.idempotencyKey,
          bookings: {
            create: selections.map(({ selection }, index) => ({
              reference: bookingReference(),
              userId: input.userId,
              facilityId: selection.facility.id,
              orderItemSequence: index + 1,
              status: BookingStatus.HELD,
              startAtUtc: selection.startAtUtc,
              endAtUtc: selection.endAtUtc,
              timezone: selection.facility.timezone,
              slotCount: selection.durationMinutes / selection.facility.slotIntervalMinutes,
              amountMinor: selection.price.amountMinor,
              currency: selection.price.currency,
              priceSnapshot: selection.price as unknown as Prisma.InputJsonValue,
              paymentHoldExpiresAt: holdExpiresAt
            }))
          },
          payment: {
            create: {
              provider: PaymentProvider.MANUAL,
              providerReference: reference,
              method: "manual_gcash",
              status: PaymentStatus.AWAITING_PAYMENT,
              amountMinor: baseAmountMinor,
              currency: "PHP",
              expiresAt: holdExpiresAt
            }
          }
        },
        include: { payment: true, bookings: { orderBy: { orderItemSequence: "asc" } } }
      });

      await tx.cart.update({
        where: { id: cart.id },
        data: { status: CartStatus.CHECKED_OUT, lastActivityAt: now, version: { increment: 1 } }
      });
      await writeAuditLog(tx, {
        actorUserId: input.userId,
        action: "booking_order.created",
        entityType: "BookingOrder",
        entityId: order.id,
        after: { reference: order.reference, status: order.status, bookingIds: order.bookings.map((booking) => booking.id), baseAmountMinor },
        metadata: { cartId: cart.id, idempotencyKey: input.idempotencyKey }
      });
      for (const booking of order.bookings) {
        await writeAuditLog(tx, {
          actorUserId: input.userId,
          action: "booking_order.child_booking_created",
          entityType: "Booking",
          entityId: booking.id,
          after: { bookingOrderId: order.id, reference: booking.reference, facilityId: booking.facilityId, startAtUtc: booking.startAtUtc.toISOString(), endAtUtc: booking.endAtUtc.toISOString() }
        });
      }
      await enqueueOrderNotification(tx, {
        dedupeKey: `${order.id}:checkout-created`,
        userId: input.userId,
        bookingOrderId: order.id,
        eventType: "BOOKING_ORDER_PAYMENT_REQUESTED",
        payload: {
          subject: `Payment requested for booking order ${order.reference}`,
          heading: "Your schedules are temporarily held",
          lines: [
            `Order reference: ${order.reference}`,
            `VAT-exclusive amount due: ${formatCurrency(baseAmountMinor, "PHP")}`,
            `Payment deadline: ${holdExpiresAt.toISOString()}`,
            ...selections.map(({ selection }, index) => `${order.bookings[index]?.reference}: ${selection.facility.name}, ${formatDateTimeRange(selection.startAtUtc, selection.endAtUtc, selection.facility.timezone)}`)
          ]
        }
      });
      return order;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.bookingOrder.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { payment: true, bookings: true }
      });
      if (existing?.userId === input.userId) return existing;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2004") {
      await writeCheckoutFailureAudit(input, "One or more schedules are no longer available.");
      throw new Error("One or more schedules are no longer available. No bookings were created.");
    }
    await writeCheckoutFailureAudit(input, error instanceof Error ? error.message : "Checkout failed.");
    throw error;
  }
}

async function writeCheckoutFailureAudit(input: { userId: string; idempotencyKey: string }, reason: string) {
  try {
    await writeAuditLog(prisma, {
      actorUserId: input.userId,
      action: "booking_order.checkout_rejected",
      entityType: "CartCheckout",
      entityId: input.idempotencyKey,
      metadata: { idempotencyKey: input.idempotencyKey, reason: reason.slice(0, 300) }
    });
  } catch {
    // Preserve the authoritative checkout error if audit storage is temporarily unavailable.
  }
}
