ALTER TABLE "Booking" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Booking_idempotencyKey_key" ON "Booking"("idempotencyKey");
