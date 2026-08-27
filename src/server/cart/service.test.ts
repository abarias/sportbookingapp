import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tx: {
    cartItem: { findFirst: vi.fn(), delete: vi.fn() },
    cart: { update: vi.fn() }
  },
  prisma: { $transaction: vi.fn() }
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));

import { assertNoOverlappingCartItems, removeCartItem } from "@/server/cart/service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.tx));
  mocks.tx.cartItem.delete.mockResolvedValue({});
  mocks.tx.cart.update.mockResolvedValue({});
});

describe("cart ownership and schedule policy", () => {
  it("permits simultaneous schedules for different facilities", () => {
    const start = new Date("2026-09-01T02:00:00.000Z");
    const end = new Date("2026-09-01T03:00:00.000Z");
    expect(() => assertNoOverlappingCartItems([{ facilityId: "court-1", startAtUtc: start, endAtUtc: end }, { facilityId: "court-2", startAtUtc: start, endAtUtc: end }])).not.toThrow();
  });

  it("rejects overlapping items for the same facility", () => {
    expect(() => assertNoOverlappingCartItems([
      { facilityId: "court-1", startAtUtc: new Date("2026-09-01T02:00:00.000Z"), endAtUtc: new Date("2026-09-01T04:00:00.000Z") },
      { facilityId: "court-1", startAtUtc: new Date("2026-09-01T03:00:00.000Z"), endAtUtc: new Date("2026-09-01T05:00:00.000Z") }
    ])).toThrow(/overlapping/);
  });

  it("scopes item removal to the authenticated customer's active cart", async () => {
    mocks.tx.cartItem.findFirst.mockResolvedValue(null);
    await expect(removeCartItem("user-1", "item-from-other-cart")).rejects.toThrow(/not found/);
    expect(mocks.tx.cartItem.findFirst).toHaveBeenCalledWith({
      where: { id: "item-from-other-cart", cart: { userId: "user-1", status: "ACTIVE" } },
      select: { id: true, cartId: true }
    });
    expect(mocks.tx.cartItem.delete).not.toHaveBeenCalled();
  });
});
