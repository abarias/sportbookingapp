CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CHECKED_OUT', 'EXPIRED', 'ABANDONED');
CREATE TYPE "BookingOrderStatus" AS ENUM (
  'PENDING_PAYMENT',
  'PROOF_SUBMITTED',
  'ACTION_REQUIRED',
  'CONFIRMED',
  'PAYMENT_REJECTED',
  'EXPIRED',
  'CANCELLED'
);
CREATE TYPE "PaymentAllocationType" AS ENUM ('CHECKOUT');

ALTER TABLE "Booking"
  ADD COLUMN "reference" TEXT,
  ADD COLUMN "bookingOrderId" TEXT,
  ADD COLUMN "orderItemSequence" INTEGER;

ALTER TABLE "Payment"
  ALTER COLUMN "bookingId" DROP NOT NULL,
  ADD COLUMN "bookingOrderId" TEXT;

ALTER TABLE "NotificationDelivery"
  ALTER COLUMN "bookingId" DROP NOT NULL,
  ADD COLUMN "bookingOrderId" TEXT;

CREATE TABLE "Cart" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
  "currency" TEXT NOT NULL DEFAULT 'PHP',
  "version" INTEGER NOT NULL DEFAULT 1,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CartItem" (
  "id" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "dateKey" TEXT NOT NULL,
  "startAtUtc" TIMESTAMP(3) NOT NULL,
  "endAtUtc" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
  "durationMinutes" INTEGER NOT NULL,
  "quotedAmountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'PHP',
  "quotedPricePreview" JSONB NOT NULL,
  "quoteCalculatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CartItem_range_check" CHECK ("endAtUtc" > "startAtUtc"),
  CONSTRAINT "CartItem_duration_check" CHECK ("durationMinutes" >= 60 AND "durationMinutes" % 60 = 0),
  CONSTRAINT "CartItem_amount_check" CHECK ("quotedAmountMinor" >= 0)
);

CREATE TABLE "BookingOrder" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "status" "BookingOrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "currency" TEXT NOT NULL DEFAULT 'PHP',
  "vatTreatment" TEXT NOT NULL DEFAULT 'VAT_EXCLUSIVE',
  "baseAmountMinor" INTEGER NOT NULL,
  "amountPaidMinor" INTEGER,
  "outstandingAmountMinor" INTEGER NOT NULL,
  "checkoutSnapshot" JSONB NOT NULL,
  "checkoutAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paymentDeadline" TIMESTAMP(3),
  "proofSubmittedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "expiredAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "idempotencyKey" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BookingOrder_amounts_check" CHECK (
    "baseAmountMinor" >= 0
    AND ("amountPaidMinor" IS NULL OR "amountPaidMinor" >= 0)
    AND "outstandingAmountMinor" >= 0
  ),
  CONSTRAINT "BookingOrder_vat_treatment_check" CHECK ("vatTreatment" = 'VAT_EXCLUSIVE')
);

CREATE TABLE "PaymentAllocation" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "bookingOrderId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'PHP',
  "type" "PaymentAllocationType" NOT NULL DEFAULT 'CHECKOUT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentAllocation_amount_check" CHECK ("amountMinor" >= 0)
);

UPDATE "Booking" booking
SET "reference" = payment."providerReference"
FROM "Payment" payment
WHERE payment."bookingId" = booking."id"
  AND booking."reference" IS NULL
  AND payment."providerReference" IS NOT NULL;

CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");
CREATE INDEX "Booking_bookingOrderId_orderItemSequence_idx" ON "Booking"("bookingOrderId", "orderItemSequence");
CREATE UNIQUE INDEX "Booking_bookingOrderId_orderItemSequence_key" ON "Booking"("bookingOrderId", "orderItemSequence");

CREATE UNIQUE INDEX "Cart_one_active_per_user_key" ON "Cart"("userId") WHERE "status" = 'ACTIVE';
CREATE INDEX "Cart_userId_status_idx" ON "Cart"("userId", "status");
CREATE INDEX "Cart_status_expiresAt_idx" ON "Cart"("status", "expiresAt");

CREATE UNIQUE INDEX "CartItem_cartId_facilityId_startAtUtc_endAtUtc_key" ON "CartItem"("cartId", "facilityId", "startAtUtc", "endAtUtc");
CREATE INDEX "CartItem_cartId_createdAt_idx" ON "CartItem"("cartId", "createdAt");
CREATE INDEX "CartItem_facilityId_startAtUtc_endAtUtc_idx" ON "CartItem"("facilityId", "startAtUtc", "endAtUtc");

CREATE UNIQUE INDEX "BookingOrder_cartId_key" ON "BookingOrder"("cartId");
CREATE UNIQUE INDEX "BookingOrder_reference_key" ON "BookingOrder"("reference");
CREATE UNIQUE INDEX "BookingOrder_idempotencyKey_key" ON "BookingOrder"("idempotencyKey");
CREATE INDEX "BookingOrder_userId_createdAt_idx" ON "BookingOrder"("userId", "createdAt");
CREATE INDEX "BookingOrder_status_paymentDeadline_idx" ON "BookingOrder"("status", "paymentDeadline");

CREATE UNIQUE INDEX "Payment_bookingOrderId_key" ON "Payment"("bookingOrderId");
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_bookingId_key" ON "PaymentAllocation"("paymentId", "bookingId");
CREATE INDEX "PaymentAllocation_bookingOrderId_bookingId_idx" ON "PaymentAllocation"("bookingOrderId", "bookingId");
CREATE INDEX "PaymentAllocation_bookingId_idx" ON "PaymentAllocation"("bookingId");
CREATE INDEX "NotificationDelivery_bookingOrderId_createdAt_idx" ON "NotificationDelivery"("bookingOrderId", "createdAt");

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_exactly_one_owner_check"
  CHECK (num_nonnulls("bookingId", "bookingOrderId") = 1);

ALTER TABLE "NotificationDelivery"
  ADD CONSTRAINT "NotificationDelivery_exactly_one_subject_check"
  CHECK (num_nonnulls("bookingId", "bookingOrderId") = 1);

ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingOrder" ADD CONSTRAINT "BookingOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingOrder" ADD CONSTRAINT "BookingOrder_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_bookingOrderId_fkey" FOREIGN KEY ("bookingOrderId") REFERENCES "BookingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingOrderId_fkey" FOREIGN KEY ("bookingOrderId") REFERENCES "BookingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_bookingOrderId_fkey" FOREIGN KEY ("bookingOrderId") REFERENCES "BookingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_bookingOrderId_fkey" FOREIGN KEY ("bookingOrderId") REFERENCES "BookingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION enforce_payment_allocation_reconciliation()
RETURNS trigger AS $$
DECLARE
  target_payment_id TEXT;
  target_order_id TEXT;
  payment_status "PaymentStatus";
  expected_amount INTEGER;
  allocated_amount BIGINT;
  invalid_allocation_count BIGINT;
BEGIN
  target_payment_id := CASE WHEN TG_TABLE_NAME = 'Payment' THEN NEW."id" ELSE COALESCE(NEW."paymentId", OLD."paymentId") END;

  SELECT "bookingOrderId", "status", "amountMinor"
  INTO target_order_id, payment_status, expected_amount
  FROM "Payment"
  WHERE "id" = target_payment_id;

  IF target_order_id IS NULL OR payment_status NOT IN ('VERIFIED', 'PAID') THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(allocation."amountMinor"), 0), COUNT(*) FILTER (
    WHERE allocation."bookingOrderId" <> target_order_id
      OR booking."bookingOrderId" <> target_order_id
  )
  INTO allocated_amount, invalid_allocation_count
  FROM "PaymentAllocation" allocation
  JOIN "Booking" booking ON booking."id" = allocation."bookingId"
  WHERE allocation."paymentId" = target_payment_id;

  IF invalid_allocation_count > 0 OR allocated_amount <> expected_amount THEN
    RAISE EXCEPTION 'Verified order payment allocations must match the payment and order.' USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "Payment_allocation_reconciliation"
AFTER INSERT OR UPDATE OF "status", "amountMinor", "bookingOrderId"
ON "Payment" DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_payment_allocation_reconciliation();

CREATE CONSTRAINT TRIGGER "PaymentAllocation_reconciliation"
AFTER INSERT OR UPDATE OR DELETE
ON "PaymentAllocation" DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_payment_allocation_reconciliation();

ALTER TABLE "Cart" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CartItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BookingOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentAllocation" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "Cart", "CartItem", "BookingOrder", "PaymentAllocation" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "Cart", "CartItem", "BookingOrder", "PaymentAllocation" FROM authenticated;
  END IF;
END $$;
