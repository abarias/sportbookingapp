import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requireUserSession: vi.fn(),
  initiateBookingReschedule: vi.fn(),
  rejectReschedulePayment: vi.fn(),
  resolveLowerPriceAdjustment: vi.fn(),
  submitReschedulePaymentProof: vi.fn(),
  verifyReschedulePayment: vi.fn(),
  revalidatePath: vi.fn(),
  after: vi.fn(),
  storePaymentProof: vi.fn(),
  deliverPendingRescheduleNotifications: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/auth/authorization", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/auth/session", () => ({ requireUserSession: mocks.requireUserSession }));
vi.mock("@/lib/storage/payment-proofs", () => ({ storePaymentProof: mocks.storePaymentProof }));
vi.mock("@/lib/notifications/rescheduling", () => ({
  deliverPendingRescheduleNotifications: mocks.deliverPendingRescheduleNotifications
}));
vi.mock("@/server/bookings/rescheduling", () => ({
  initiateBookingReschedule: mocks.initiateBookingReschedule,
  rejectReschedulePayment: mocks.rejectReschedulePayment,
  resolveLowerPriceAdjustment: mocks.resolveLowerPriceAdjustment,
  submitReschedulePaymentProof: mocks.submitReschedulePaymentProof,
  verifyReschedulePayment: mocks.verifyReschedulePayment
}));

import {
  initiateRescheduleAction,
  verifyReschedulePaymentAction
} from "./actions";

beforeEach(() => vi.clearAllMocks());

describe("rescheduling server-action authorization", () => {
  it("rejects a crafted initiate request without bookings.reschedule", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("Forbidden"));
    const formData = new FormData();

    await expect(initiateRescheduleAction({}, formData)).rejects.toThrow("Forbidden");
    expect(mocks.requirePermission).toHaveBeenCalledWith("bookings.reschedule");
    expect(mocks.initiateBookingReschedule).not.toHaveBeenCalled();
  });

  it("rejects direct adjustment verification without payments.verify", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("Forbidden"));
    const formData = new FormData();

    await expect(verifyReschedulePaymentAction({}, formData)).rejects.toThrow("Forbidden");
    expect(mocks.requirePermission).toHaveBeenCalledWith("payments.verify");
    expect(mocks.verifyReschedulePayment).not.toHaveBeenCalled();
  });
});
