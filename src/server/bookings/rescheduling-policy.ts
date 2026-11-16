import {
  BookingRescheduleStatus,
  BookingStatus,
  PaymentStatus,
  PriceAdjustmentResolution,
  PriceAdjustmentStatus,
  PriceAdjustmentType
} from "@prisma/client";

export function isVerifiedPayment(status: PaymentStatus | null) {
  return status === PaymentStatus.VERIFIED || status === PaymentStatus.PAID;
}

export function assertRescheduleEligibility(input: {
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus | null;
  startAtUtc: Date;
  now: Date;
  cutoffHours: number;
  activeRequestCount: number;
}) {
  if (input.bookingStatus !== BookingStatus.CONFIRMED || !isVerifiedPayment(input.paymentStatus)) {
    throw new Error("Only paid, payment-verified, confirmed bookings can be rescheduled.");
  }
  if (input.startAtUtc <= input.now) {
    throw new Error("Completed or past bookings cannot be rescheduled.");
  }
  if (input.activeRequestCount > 0) {
    throw new Error("This booking already has an active rescheduling request.");
  }
  if (input.startAtUtc.getTime() - input.now.getTime() < input.cutoffHours * 60 * 60_000) {
    throw new Error(`Bookings cannot be rescheduled within ${input.cutoffHours} hours of the current start time.`);
  }
}

export function calculateRescheduleAdjustment(input: {
  originalAmountMinor: number;
  replacementAmountMinor: number;
  waivedAmountMinor: number;
  canOverrideAdjustment: boolean;
  hasCustomerNote: boolean;
}) {
  const differenceMinor = input.replacementAmountMinor - input.originalAmountMinor;
  const adjustmentType = differenceMinor === 0
    ? PriceAdjustmentType.SAME_PRICE
    : differenceMinor < 0
      ? PriceAdjustmentType.LOWER_PRICE
      : PriceAdjustmentType.HIGHER_PRICE;

  if (!Number.isInteger(input.waivedAmountMinor) || input.waivedAmountMinor < 0) {
    throw new Error("The waived amount must be a non-negative whole minor-unit amount.");
  }
  if (input.waivedAmountMinor > 0 && !input.canOverrideAdjustment) {
    throw new Error("You do not have permission to waive a price adjustment.");
  }
  if (input.waivedAmountMinor > Math.max(0, differenceMinor)) {
    throw new Error("The waived amount cannot exceed the additional amount.");
  }
  if (input.waivedAmountMinor > 0 && !input.hasCustomerNote) {
    throw new Error("A customer-facing note is required when waiving an amount.");
  }

  const additionalAmountDueMinor = Math.max(0, differenceMinor - input.waivedAmountMinor);
  const requiresAdditionalPayment = additionalAmountDueMinor > 0;
  const status = requiresAdditionalPayment
    ? BookingRescheduleStatus.ADDITIONAL_PAYMENT_REQUIRED
    : BookingRescheduleStatus.COMPLETED;
  const adjustmentStatus = requiresAdditionalPayment
    ? PriceAdjustmentStatus.ADDITIONAL_PAYMENT_REQUIRED
    : adjustmentType === PriceAdjustmentType.LOWER_PRICE
      ? PriceAdjustmentStatus.UNRESOLVED
      : input.waivedAmountMinor > 0
        ? PriceAdjustmentStatus.WAIVED
        : PriceAdjustmentStatus.NONE;

  return {
    differenceMinor,
    adjustmentType,
    waivedAmountMinor: input.waivedAmountMinor,
    additionalAmountDueMinor,
    requiresAdditionalPayment,
    status,
    adjustmentStatus
  };
}

export function assertLowerPriceResolution(input: {
  priceDifferenceMinor: number;
  method: Exclude<PriceAdjustmentResolution, "WAIVER">;
  amountMinor: number;
}) {
  if (input.priceDifferenceMinor >= 0) {
    throw new Error("A lower-price resolution requires a negative price difference.");
  }
  const availableAmount = Math.abs(input.priceDifferenceMinor);
  if (!Number.isInteger(input.amountMinor) || input.amountMinor < 0 || input.amountMinor > availableAmount) {
    throw new Error("Resolution amount is outside the available adjustment.");
  }
  if (input.method === PriceAdjustmentResolution.NO_REFUND) {
    if (input.amountMinor !== 0) {
      throw new Error("A no-refund resolution must record a zero resolved amount.");
    }
    return;
  }
  if (input.amountMinor !== availableAmount) {
    throw new Error("The resolution amount must account for the full price difference.");
  }
}
