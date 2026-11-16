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
  -- NEW is only valid for INSERT/UPDATE and OLD is only valid for DELETE/UPDATE.
  -- Keep the branches separate so PostgreSQL never evaluates the wrong transition record.
  IF TG_TABLE_NAME = 'Payment' THEN
    target_payment_id := NEW."id";
  ELSIF TG_OP = 'DELETE' THEN
    target_payment_id := OLD."paymentId";
  ELSE
    target_payment_id := NEW."paymentId";
  END IF;

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
