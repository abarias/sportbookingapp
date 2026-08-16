# Sport Booking PH

MVP sports facility booking app for Philippine operators. The app supports customer booking flows and internal admin operations for full basketball courts, half basketball courts, pickleball courts, and badminton courts.

## Current Status

Current MVP feature set:

- Next.js App Router + TypeScript strict mode
- Tailwind CSS UI scaffold
- Prisma + PostgreSQL schema, migrations, and seed data
- Credentials auth for customer and admin accounts
- Customer mobile number capture and OTP verification during registration
- Database-backed facility browsing and availability
- Server-side booking creation with overlap checks
- Manual payment hold flow with customer proof upload and admin verification
- Customer booking history and policy-based cancellation flow
- Admin overview, booking calendar, facility management, blocked schedules, walk-in booking, customers, and reports
- Facility creation and editing with multiple image URLs or uploaded image files
- Booking window rules limiting customers to the current/next month, with next-two-month visibility opening on the last Monday of the month
- Basic automated coverage for availability, cancellation policy, and blocked schedule validation

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma
- NextAuth
- Vercel

## Local Development

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL:

```bash
docker compose up -d postgres
```

3. Install dependencies:

```bash
npm install
```

4. Generate Prisma client and apply migrations:

```bash
npm run db:generate
npx prisma migrate dev
```

5. Seed sample data:

```bash
npm run db:seed
```

6. Start the app:

```bash
npm run dev
```

7. Validate locally:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

If Next.js shows stale chunk errors, clear the build output once:

```bash
rm -rf .next
```

## Seeded Accounts

- Admin: `admin@sportbooking.local` / `Admin12345!`
- Customer: `player@sportbooking.local` / `Player12345!`

These local development defaults only work when `DATABASE_URL` points to a local database. For any remote database, set secure `SEED_*` credentials or use the production admin bootstrap flow.

Seeded accounts are marked as mobile-verified. Newly registered customer accounts must complete the OTP verification step before sign-in.

## Production Admin Bootstrap

Do not run the development seed against production. The seed script refuses to run in strict production mode and refuses default credentials against remote databases.

To create or rotate the first production admin account, set secure bootstrap variables locally or in a trusted shell:

```bash
ADMIN_BOOTSTRAP_EMAIL="owner@example.com" \
ADMIN_BOOTSTRAP_PASSWORD="use-a-strong-unique-password" \
ADMIN_BOOTSTRAP_FULL_NAME="Facility Owner" \
ADMIN_BOOTSTRAP_PHONE="+639171234567" \
npm run admin:bootstrap
```

The bootstrap script never prints the password. It marks the admin email as verified and marks the phone as verified only when a phone number is provided.

## Feature Notes

### Facility Management

Admins can manage existing facilities at `/admin/facilities` and create new facilities from the same page. Each facility supports:

- name, slug, description, type, enabled state
- per-hour pricing and minimum duration
- Hourly customer booking increments with 30-minute internal slot resolution
- operating hours by day
- global or per-facility cancellation policy overrides
- multiple images through either image URLs or uploaded image files

Uploaded images are stored locally in `public/uploads/facilities`. This is suitable for local development and lightweight demos. For production, move facility image storage to Cloudinary, Supabase Storage, S3, or another persistent object store because Vercel filesystem writes are not durable.

### Customer Registration And OTP

Customer registration captures:

- full name
- email
- Philippine mobile number
- password

After account creation, the customer must verify a 6-digit OTP before they can sign in. The current implementation uses a development-visible mock OTP instead of sending SMS. This keeps the registration workflow testable while leaving the SMS provider decision open.

Production SMS integration should replace the mock display with a provider such as Semaphore, Twilio, Vonage, or another Philippine-friendly SMS provider.

### Walk-In Bookings

Admins can create desk-assisted bookings at `/admin/walk-ins`. The form captures customer name, mobile number, optional email, facility, date, time, and duration. The system creates or reuses a customer record, marks the mobile number as verified because staff captured it in person, and creates a confirmed booking through the same server-side validation path as customer bookings.

### Booking Window

Customer-facing booking dates are limited by business policy:

- before the last Monday of the current month: customers can book through the end of next month
- on or after the last Monday of the current month: customers can book through the end of the next two months

The browser date picker and server-side booking creation both enforce this rule.

### Booking And Payment Lifecycle

Customer bookings now separate reservation state from payment state:

- Selecting a date/time does not create a reservation hold.
- Clicking `Reserve & Pay` creates a server-validated `HELD` booking and an `AWAITING_PAYMENT` manual payment record.
- The default hold window is 15 minutes through `PAYMENT_HOLD_MINUTES` or the `booking.paymentHoldMinutes` setting.
- Submitted payment proof changes payment status to `SUBMITTED` and stops the payment hold countdown, but does not confirm the booking.
- Admin verification changes payment status to `VERIFIED` and booking status to `CONFIRMED`.
- Admin rejection changes payment status to `REJECTED` and releases the held slot.
- Admin `Action Required` keeps the booking held while the customer resubmits clearer proof.

Current manual payment proof uploads are stored under `public/uploads/payment-proofs` for MVP/demo use. Move this to durable private object storage before production.

### Cancellation Policy

Cancellation is controlled by both eligibility and timing:

- cancellation must be enabled globally or enabled by a facility override
- the booking must be future and confirmed
- the request must happen within the configured cancellation window after booking creation

The global cancellation window defaults to 24 hours and can be changed from the admin overview. Facilities can optionally override the cancellation window in hours.

## Environment Variables

Defined in `.env.example`:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `PAYMONGO_SECRET_KEY`
- `PAYMONGO_PUBLIC_KEY`
- `PAYMONGO_WEBHOOK_SECRET`
- `APP_TIMEZONE`
- `PAYMENT_HOLD_MINUTES`
- `PAYMENT_MODE`
- `ALLOW_PRODUCTION_MOCK_PAYMENTS`
- `AUTH_STRICT_ENV_VALIDATION`
- `CRON_SECRET`
- `AUTH_REGISTRATION_WINDOW_MINUTES`
- `AUTH_MAX_REGISTRATION_ATTEMPTS`
- `AUTH_EMAIL_VERIFICATION_EXPIRY_MINUTES`
- `AUTH_MAX_EMAIL_VERIFICATION_ATTEMPTS`
- `AUTH_RESEND_VERIFICATION_WINDOW_MINUTES`
- `AUTH_MAX_RESEND_VERIFICATION_ATTEMPTS`
- `AUTH_VERIFICATION_TOKEN_RETENTION_DAYS`
- `AUTH_REGISTRATION_ATTEMPT_RETENTION_DAYS`
- `NEXT_PUBLIC_APP_NAME`
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`
- `SEED_CUSTOMER_EMAIL`
- `SEED_CUSTOMER_PASSWORD`
- `ADMIN_BOOTSTRAP_EMAIL`
- `ADMIN_BOOTSTRAP_PASSWORD`
- `ADMIN_BOOTSTRAP_FULL_NAME`
- `ADMIN_BOOTSTRAP_PHONE`

## Email Delivery

Customer email verification uses the internal email adapter in `src/lib/notifications/email.ts`.

- Set `RESEND_API_KEY` and `EMAIL_FROM` to send real verification emails through Resend.
- Verify the sender domain in Resend before production use.
- If Resend is not configured outside production, the app logs the verification code to the dev server console and shows it in the development UI.
- In production, missing email configuration throws an error so registration does not silently create accounts that cannot be verified.

## Auth Maintenance

Email verification tokens and registration abuse-tracking attempts should be cleaned up routinely:

```bash
npm run auth:cleanup
```

Defaults:

- registrations are limited to 5 attempts per email/IP every 15 minutes
- email verification codes expire after 15 minutes
- verification codes allow 5 failed attempts
- verification resend is limited to 3 attempts per email/IP every 10 minutes
- expired verification tokens are retained for 7 days after expiry
- registration attempts are retained for 90 days

Use the `AUTH_*` environment variables to adjust auth throttling and retention. For production, run this daily through Vercel Cron or an equivalent scheduled job.

## Production Environment Validation

The app validates critical server environment variables during startup and build.

- Vercel production deployments run strict validation automatically through `VERCEL_ENV=production`.
- Use `AUTH_STRICT_ENV_VALIDATION=true` to test production-style validation outside Vercel.
- `PAYMENT_MODE=manual` is the safest production setting while real payment gateway work is deferred.
- `PAYMENT_MODE=mock` is blocked in production unless `ALLOW_PRODUCTION_MOCK_PAYMENTS=true` is explicitly set for controlled demos.
- `PAYMENT_MODE=gateway` requires PayMongo secret, public, and webhook keys.

For the current demo deployment, use mock payments only if the client understands that bookings are auto-confirmed and no real collection happens.

## Scheduled Maintenance

Pending unpaid bookings are expired by `GET /api/cron/expire-bookings`.

- Vercel Hobby runs this route once daily from `vercel.json`; Vercel Pro or an equivalent scheduler can run it more frequently.
- Production requests require `Authorization: Bearer <CRON_SECRET>`.
- Set a strong `CRON_SECRET` in Vercel before deploying this route.
- Local development may call the route without `CRON_SECRET` unless strict env validation is enabled.

## Project Structure

```text
src/
  app/          Route entry points and layouts
  components/   Reusable UI and form components
  features/     Server actions and feature schemas
  lib/          Shared utilities, auth, db, formatting, time helpers
  server/       Booking, policy, facility, and admin business logic
docs/           Architecture notes
prisma/         Schema, migrations, and seed data
```

## Deployment

Recommended MVP deployment:

1. Create a hosted Postgres database on Neon or Supabase.
2. Set all production env vars in Vercel.
3. Run Prisma migrations against production:

```bash
npx prisma migrate deploy
```

4. Create the initial production admin with `npm run admin:bootstrap` from a secure environment.
5. Deploy the Next.js app to Vercel.

Production notes:

- Keep `NEXTAUTH_SECRET` unique per environment.
- Use a strong production database password.
- Customer payment confirmation now requires admin verification of submitted proof.
- Local payment proof uploads are stored on disk and should be moved to persistent private object storage before launch.
- Mock OTP is still enabled in this MVP and should be replaced with a real SMS provider before launch.
- Local image uploads are stored on disk and should be moved to persistent object storage before launch.
- Refund handling is still manual.

## Assumptions

- Single branch/location only
- Customers use email/password accounts
- Customers must verify a Philippine mobile number during registration
- Admins are internal staff only
- Fixed hourly customer booking increments
- Pricing is per facility without peak/off-peak tiers
- Mock payment is temporary until a real gateway is chosen
- Mock OTP is temporary until an SMS provider is chosen
- Admin-assisted walk-in bookings create or reuse customer records
- Cancellation is allowed only for future confirmed bookings when policy and cancellation window permit it

## Post-MVP Recommendations

- Replace mock payments with verified PayMongo or another gateway
- Replace mock OTP with real SMS delivery and rate limiting
- Move uploaded facility images to persistent object storage
- Add webhook-driven payment confirmation and expiry handling
- Add refund tracking and staff workflows
- Add booking filters, pagination, and richer reporting
- Add email notifications and audit history
- Add multi-branch support if operations expand

## Architecture Notes

See [docs/architecture.md](docs/architecture.md) for the MVP architecture, schema direction, and core tradeoffs.
