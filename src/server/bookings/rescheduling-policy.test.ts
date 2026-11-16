import {
  BookingRescheduleStatus,
  BookingStatus,
  PaymentStatus,
  PriceAdjustmentResolution,
  PriceAdjustmentStatus,
  PriceAdjustmentType
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  assertLowerPriceResolution,
  assertRescheduleEligibility,
  calculateRescheduleAdjustment
} from "./rescheduling-policy";

const now = new Date("2026-08-24T00:00:00.000Z");

describe("rescheduling eligibility", () => {
  const eligible = {
    bookingStatus: BookingStatus.CONFIRMED,
    paymentStatus: PaymentStatus.VERIFIED,
    startAtUtc: new Date("2026-08-27T00:00:00.000Z"),
    now,
    cutoffHours: 24,
    activeRequestCount: 0
  };

  it("accepts a future, verified, confirmed booking outside the cutoff", () => {
    expect(() => assertRescheduleEligibility(eligible)).not.toThrow();
  });

  it.each([
    ["unpaid", { paymentStatus: PaymentStatus.AWAITING_PAYMENT }],
    ["cancelled", { bookingStatus: BookingStatus.CANCELLED }],
    ["expired", { bookingStatus: BookingStatus.EXPIRED }],
    ["past", { startAtUtc: new Date("2026-08-23T00:00:00.000Z") }],
    ["active request", { activeRequestCount: 1 }],
    ["inside cutoff", { startAtUtc: new Date("2026-08-24T12:00:00.000Z") }]
  ])("rejects an %s booking", (_label, override) => {
    expect(() => assertRescheduleEligibility({ ...eligible, ...override })).toThrow();
  });
});

describe("lower-price adjustment resolution", () => {
  it.each([
    PriceAdjustmentResolution.MANUAL_REFUND,
    PriceAdjustmentResolution.CUSTOMER_CREDIT,
    PriceAdjustmentResolution.OTHER
  ])("requires the full difference for %s", (method) => {
    expect(() => assertLowerPriceResolution({ priceDifferenceMinor: -50_000, method, amountMinor: 50_000 })).not.toThrow();
    expect(() => assertLowerPriceResolution({ priceDifferenceMinor: -50_000, method, amountMinor: 25_000 })).toThrow(/full price difference/i);
  });

  it("requires a zero amount for an approved no-refund outcome", () => {
    expect(() => assertLowerPriceResolution({ priceDifferenceMinor: -50_000, method: PriceAdjustmentResolution.NO_REFUND, amountMinor: 0 })).not.toThrow();
    expect(() => assertLowerPriceResolution({ priceDifferenceMinor: -50_000, method: PriceAdjustmentResolution.NO_REFUND, amountMinor: 50_000 })).toThrow(/zero/i);
  });
});

describe("rescheduling price adjustment policy", () => {
  it("completes a same-price move without an adjustment", () => {
    expect(calculateRescheduleAdjustment({
      originalAmountMinor: 150_000,
      replacementAmountMinor: 150_000,
      waivedAmountMinor: 0,
      canOverrideAdjustment: false,
      hasCustomerNote: false
    })).toMatchObject({
      adjustmentType: PriceAdjustmentType.SAME_PRICE,
      status: BookingRescheduleStatus.COMPLETED,
      adjustmentStatus: PriceAdjustmentStatus.NONE,
      additionalAmountDueMinor: 0
    });
  });

  it("completes a lower-price move with an unresolved manual adjustment", () => {
    expect(calculateRescheduleAdjustment({
      originalAmountMinor: 200_000,
      replacementAmountMinor: 150_000,
      waivedAmountMinor: 0,
      canOverrideAdjustment: false,
      hasCustomerNote: false
    })).toMatchObject({
      differenceMinor: -50_000,
      adjustmentType: PriceAdjustmentType.LOWER_PRICE,
      status: BookingRescheduleStatus.COMPLETED,
      adjustmentStatus: PriceAdjustmentStatus.UNRESOLVED
    });
  });

  it("holds a higher-price replacement for only the additional amount", () => {
    expect(calculateRescheduleAdjustment({
      originalAmountMinor: 150_000,
      replacementAmountMinor: 220_000,
      waivedAmountMinor: 0,
      canOverrideAdjustment: false,
      hasCustomerNote: false
    })).toMatchObject({
      differenceMinor: 70_000,
      adjustmentType: PriceAdjustmentType.HIGHER_PRICE,
      status: BookingRescheduleStatus.ADDITIONAL_PAYMENT_REQUIRED,
      adjustmentStatus: PriceAdjustmentStatus.ADDITIONAL_PAYMENT_REQUIRED,
      additionalAmountDueMinor: 70_000
    });
  });

  it("supports authorized partial and full waivers", () => {
    expect(calculateRescheduleAdjustment({ originalAmountMinor: 100_000, replacementAmountMinor: 150_000, waivedAmountMinor: 20_000, canOverrideAdjustment: true, hasCustomerNote: true })).toMatchObject({
      status: BookingRescheduleStatus.ADDITIONAL_PAYMENT_REQUIRED,
      additionalAmountDueMinor: 30_000
    });
    expect(calculateRescheduleAdjustment({ originalAmountMinor: 100_000, replacementAmountMinor: 150_000, waivedAmountMinor: 50_000, canOverrideAdjustment: true, hasCustomerNote: true })).toMatchObject({
      status: BookingRescheduleStatus.COMPLETED,
      adjustmentStatus: PriceAdjustmentStatus.WAIVED,
      additionalAmountDueMinor: 0
    });
  });

  it("rejects unauthorized, excessive, and undocumented waivers", () => {
    expect(() => calculateRescheduleAdjustment({ originalAmountMinor: 100_000, replacementAmountMinor: 150_000, waivedAmountMinor: 10_000, canOverrideAdjustment: false, hasCustomerNote: true })).toThrow(/permission/i);
    expect(() => calculateRescheduleAdjustment({ originalAmountMinor: 100_000, replacementAmountMinor: 150_000, waivedAmountMinor: 60_000, canOverrideAdjustment: true, hasCustomerNote: true })).toThrow(/exceed/i);
    expect(() => calculateRescheduleAdjustment({ originalAmountMinor: 100_000, replacementAmountMinor: 150_000, waivedAmountMinor: 10_000, canOverrideAdjustment: true, hasCustomerNote: false })).toThrow(/customer-facing note/i);
  });
});
