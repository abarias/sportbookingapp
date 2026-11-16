import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(path.join(process.cwd(), "prisma/migrations/20260827090000_add_booking_cart_and_orders/migration.sql"), "utf8");
const triggerFix = readFileSync(path.join(process.cwd(), "prisma/migrations/20260827100000_fix_payment_allocation_trigger/migration.sql"), "utf8");

describe("booking cart and orders migration", () => {
  it("adds normalized carts, orders, child links, and allocations without rewriting booking prices", () => {
    expect(migration).toContain('CREATE TABLE "Cart"');
    expect(migration).toContain('CREATE TABLE "CartItem"');
    expect(migration).toContain('CREATE TABLE "BookingOrder"');
    expect(migration).toContain('CREATE TABLE "PaymentAllocation"');
    expect(migration).toContain('ADD COLUMN "bookingOrderId" TEXT');
    expect(migration).not.toContain('UPDATE "Booking" SET "amountMinor"');
  });

  it("enforces one active cart, idempotent checkout, and one payment owner", () => {
    expect(migration).toContain('Cart_one_active_per_user_key');
    expect(migration).toContain('BookingOrder_idempotencyKey_key');
    expect(migration).toContain('Payment_exactly_one_owner_check');
    expect(migration).toContain('CartItem_cartId_facilityId_startAtUtc_endAtUtc_key');
  });

  it("reconciles a verified consolidated payment to child allocations", () => {
    expect(migration).toContain('enforce_payment_allocation_reconciliation');
    expect(migration).toContain('allocated_amount <> expected_amount');
    expect(migration).toContain('Payment_allocation_reconciliation');
  });

  it("uses operation-safe trigger transition branches", () => {
    expect(triggerFix).toContain("ELSIF TG_OP = 'DELETE'");
    expect(triggerFix).toContain('target_payment_id := OLD."paymentId"');
  });

  it("denies browser database roles access to sensitive order tables", () => {
    for (const table of ["Cart", "CartItem", "BookingOrder", "PaymentAllocation"]) {
      expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    }
    expect(migration).toContain('REVOKE ALL ON TABLE "Cart", "CartItem", "BookingOrder", "PaymentAllocation" FROM anon');
    expect(migration).toContain('FROM authenticated');
  });
});
