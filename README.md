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
- Rule-based facility pricing by weekday, weekend, selected day, holiday, time range, and effective date
- Generated public VAT-exclusive rate cards and immutable booking price snapshots
- Configurable administrative roles with permission-based navigation, server authorization, protected Super Admin recovery, and audit logging
- Permission-controlled administrative rescheduling with immutable schedule/price history, additional-payment holds, manual adjustments, and customer notifications
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

Browser smoke tests require a running local database and seeded accounts. Install Chromium once with `npx playwright install chromium`, start the app with `npm run dev`, then run `npm run test:e2e`. CI starts the app against its disposable seeded database automatically.

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

The bootstrap script never prints the password. It marks the admin email as verified, marks the phone as verified only when a phone number is provided, activates administrative access, and assigns the protected Super Admin role. Apply all database migrations before running it.

## Feature Notes

### Administrative Roles And Permissions

Administrative access is derived from active role assignments rather than editable role names. The initial templates are Super Admin, Receptionist, Booking Admin, and Social Media Person.

- `/admin/roles` manages role definitions, permission assignments, cloning, activation, and safe deletion.
- `/admin/admin-users` assigns one or more active roles to an existing user account and previews the resulting permission union.
- `/admin/audit-logs` shows recent role, access, facility, pricing, payment, and security events.
- The protected Super Admin role cannot be deleted, deactivated, or stripped of permissions. Database triggers also prevent removal or deactivation of the last active Super Admin.
- Permission checks query the database on every protected request. Role changes therefore take effect on the next request without a permission cache flush.
- `User.role=ADMIN` remains temporarily as an account-type compatibility flag; it does not grant application capabilities without active RBAC assignments.

The RBAC migration enables deny-by-default RLS and revokes direct `anon`/`authenticated` access on RBAC and audit tables when those Supabase roles exist. Prisma must connect with the trusted server-side database role. Do not expose `DATABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` to browser code.

### Facility Management

Admins can manage existing facilities at `/admin/facilities` and create new facilities from the same page. Each facility supports:

- name, slug, description, type, enabled state
- per-hour pricing and minimum duration
- Hourly customer booking increments with 30-minute internal slot resolution
- operating hours by day
- global or per-facility cancellation policy overrides
- multiple images through either image URLs or uploaded image files

Facility images use the configured Supabase Storage bucket in hosted environments and the local filesystem only during local development. Uploads are limited to 12 files per facility update and 5MB per file, decoded server-side, restricted to JPEG/PNG/WebP/GIF input, resized when necessary, and re-encoded to WebP with metadata removed. Payment proofs use the private Supabase Storage bucket with the same content validation and size limit. Configure storage before deploying to Vercel because its filesystem is not durable.

### Customer Registration And OTP

Customer registration captures:

- full name
- email
- Philippine mobile number
- password

After account creation, the customer must verify a 6-digit code before they can sign in. Local development may display the code in the UI when email delivery is not configured. This fallback is disabled for Vercel Preview and Production deployments; hosted environments must configure Resend.

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

Local development falls back to `public/uploads/payment-proofs`; hosted deployments require the private Supabase Storage bucket configured by `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_PAYMENT_PROOFS_BUCKET`.

### Cancellation Policy

Cancellation is controlled by both eligibility and timing:

- cancellation must be enabled globally or enabled by a facility override
- the booking must be future and confirmed
- the request must happen within the configured cancellation window after booking creation

The global cancellation window defaults to 24 hours and can be changed from the admin overview. Facilities can optionally override the cancellation window in hours.

## Administrative Rescheduling

Administrators with `bookings.reschedule` can move a future paid, verified, confirmed booking from its booking-details page. Replacement availability and dynamic pricing are recalculated on the server in the facility timezone.

- Same-price moves complete atomically.
- Lower-price moves complete atomically and create an unresolved manual refund/credit decision.
- Higher-price moves hold the replacement slot while preserving the original confirmed slot. Only verification of the additional payment completes the move.
- `bookings.reschedule.override_adjustment` permits an audited full or partial waiver. It is seeded only for Super Admin.
- `bookings.reschedule.resolve_adjustment` permits recording a manual refund, customer credit, no-refund policy outcome, or other documented resolution. It is seeded for Super Admin and Booking Admin.
- Receptionist and Social Media roles do not receive paid-booking rescheduling by default.

Every attempt is stored against the original booking in `BookingReschedule`; additional payments use `ReschedulePayment` and do not overwrite the original `Payment`. This booking-level boundary is intentional so a future consolidated order can contain independently reschedulable child bookings.

## Environment Variables

Defined in `.env.example`:

- `DATABASE_URL`
- `DIRECT_URL`
- `SUPABASE_URL` — Supabase project URL used for private payment-proof storage
- `SUPABASE_SERVICE_ROLE_KEY` — server-only Supabase service-role key; never expose as `NEXT_PUBLIC_*`
- `SUPABASE_PAYMENT_PROOFS_BUCKET` — private Storage bucket name, defaults to `payment-proofs`
- `SUPABASE_FACILITY_IMAGES_BUCKET` — public Storage bucket name for facility photos, defaults to `facility-images`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `PAYMONGO_SECRET_KEY`
- `PAYMONGO_PUBLIC_KEY`
- `PAYMONGO_WEBHOOK_SECRET`
- `APP_TIMEZONE`
- `PAYMENT_HOLD_MINUTES`
- `CART_EXPIRY_DAYS` — lifetime of an inactive authenticated customer cart, defaults to 7 days
- `RESCHEDULE_PAYMENT_HOLD_MINUTES` — replacement-slot hold while an additional amount is awaiting proof, defaults to 15 minutes
- `RESCHEDULE_CUTOFF_HOURS` — minimum notice before the current booking start, defaults to 24 hours
- `PAYMENT_MODE`
- `ALLOW_PRODUCTION_MOCK_PAYMENTS`
- `AUTH_STRICT_ENV_VALIDATION`
- `CRON_SECRET`
- `HEALTHCHECK_SECRET` — bearer secret required by the hosted database-readiness endpoint
- `RATE_LIMIT_DISABLED` — local-only escape hatch; production validation rejects `true`
- `RATE_LIMIT_LOGIN_MAX` / `RATE_LIMIT_LOGIN_WINDOW_SECONDS`
- `RATE_LIMIT_BOOKING_MAX` / `RATE_LIMIT_BOOKING_WINDOW_SECONDS`
- `RATE_LIMIT_PAYMENT_PROOF_MAX` / `RATE_LIMIT_PAYMENT_PROOF_WINDOW_SECONDS`
- `RATE_LIMIT_ADMIN_MUTATION_MAX` / `RATE_LIMIT_ADMIN_MUTATION_WINDOW_SECONDS`
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

## Application Rate Limits

High-risk actions use database-backed fixed-window limits that work across Vercel instances. Bucket subjects are SHA-256 hashes derived from the request IP, authenticated user ID, or normalized login email; raw identifiers are not stored in `RateLimitBucket`.

Default policies:

- login: 10 attempts per IP/email every 15 minutes
- direct booking, consolidated checkout, and cancellation: 10 attempts per user/IP every 5 minutes
- payment-proof uploads: 6 attempts per user/IP every 15 minutes
- sensitive admin mutations: 60 attempts per user/IP every 10 minutes

Use the `RATE_LIMIT_*` environment variables to tune these limits. `RATE_LIMIT_DISABLED=true` is permitted only for local troubleshooting and is rejected by strict production environment validation. The secured booking-expiration cron also deletes expired buckets.

## Production Environment Validation

The app validates critical server environment variables during startup and build.

- Vercel production deployments run strict validation automatically through `VERCEL_ENV=production`.
- Use `AUTH_STRICT_ENV_VALIDATION=true` to test production-style validation outside Vercel.
- `PAYMENT_MODE=manual` is the safest production setting while real payment gateway work is deferred.
- `PAYMENT_MODE=mock` is blocked in production unless `ALLOW_PRODUCTION_MOCK_PAYMENTS=true` is explicitly set for controlled demos.
- `AUTH_ALLOW_MOCK_OTP=true` is accepted only for local development; it is rejected by strict hosted-environment validation. Keep it `false` in shared environments.
- `PAYMENT_MODE=gateway` requires PayMongo secret, public, and webhook keys.

Use `PAYMENT_MODE=manual` for hosted QA, staging, and production environments. Reserve mock mode for explicit local or controlled demo testing only.

## Scheduled Maintenance

Pending unpaid bookings and consolidated booking orders are expired by `GET /api/cron/expire-bookings`.

The same route expires unpaid reschedule replacement holds, retries pending rescheduling notification emails, and removes expired rate-limit buckets. Expired unpaid replacement holds are also ignored by availability reads and transitioned under a database row lock before any competing booking write, so inventory does not depend on cron timing. Proof submission removes the deadline and keeps the replacement blocked for payment review.

Consolidated checkout uses a server-side cart. Adding a schedule never holds inventory. Checkout revalidates and prices every item in one serializable transaction, creates one `BookingOrder`, creates individually traceable child `Booking` records, and establishes one payment deadline. One unavailable item rolls back the complete checkout. Verification creates per-booking payment allocations and confirms every initial child booking atomically; expiration releases every child hold while preserving the order history.

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

See [Deployment Environments](docs/deployment-environments.md) for the current Development, QA, staging, production, branching, DNS, Vercel, and Supabase setup.

See [Production Operations](docs/production-operations.md) for release gates, health monitoring, Supabase validation, backup/restore drills, rollback, and incident response.

Recommended MVP deployment:

1. Create a hosted Postgres database on Neon or Supabase.
2. Set all production env vars in Vercel.
3. Run Prisma migrations against production:

```bash
npx prisma migrate deploy
```

4. Create the initial production admin with `npm run admin:bootstrap` from a secure environment.
5. Deploy the Next.js app to Vercel.

For the rescheduling release, deploy `20260824110000_add_booking_rescheduling` before deploying the application build. The migration is additive: it preserves existing bookings, payment records, references, and price snapshots. After deployment, verify the Super Admin and Booking Admin permission assignments, then smoke-test one same-price, lower-price, and higher-price move using non-production booking data.

For the multi-booking checkout release, deploy `20260827090000_add_booking_cart_and_orders` and then `20260827100000_fix_payment_allocation_trigger` before the application build. These additive migrations leave legacy booking-level payments intact and do not recalculate historical prices. After deploying the app, confirm that `/api/cron/expire-bookings` is scheduled, then smoke-test one two-facility checkout, one consolidated proof review, payment verification, child-booking rescheduling, and order expiration using synthetic data. Roll back the application build if needed; retain the additive tables and columns rather than attempting a destructive production down migration.

For payment-proof uploads, create a **private** Supabase Storage bucket named
`payment-proofs`, and for facility uploads create a **public** bucket named
`facility-images`, in each environment's Supabase project. Set the following
server-only Vercel environment variables for Preview/Staging and Production,
using the matching Supabase project in each environment:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
SUPABASE_PAYMENT_PROOFS_BUCKET=payment-proofs
SUPABASE_FACILITY_IMAGES_BUCKET=facility-images
```

After configuring a hosted environment, verify the bucket visibility without changing storage:

```bash
npm run storage:check
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` as a `NEXT_PUBLIC_*` variable. Redeploy
after adding or changing these variables. Local development can omit them and
will store proofs under `public/uploads/payment-proofs` instead.

Production notes:

- Keep `NEXTAUTH_SECRET` unique per environment.
- Use a strong production database password.
- Customer payment confirmation now requires admin verification of submitted proof.
- Payment proof and facility image uploads use private Supabase Storage buckets on Vercel. Local development falls back to `public/uploads` when Supabase Storage variables are absent.
- Mock OTP is still enabled in this MVP and should be replaced with a real SMS provider before launch.
- Refund handling is still manual.

### Dynamic pricing deployment

Apply `20260822090000_add_dynamic_pricing` before deploying this feature. The migration preserves existing booking totals and converts existing facility prices into default fallback rules. It does not recalculate historical bookings.

Administrators manage schedule overrides and the manual holiday calendar under `/admin/pricing`. Pricing precedence is: configured holiday, selected day of week, weekend, weekday, then facility default. All displayed and calculated amounts are base prices exclusive of VAT.

## Assumptions

- Single branch/location only
- Customers use email/password accounts
- Customers verify their email address during registration; mobile numbers are captured for future alerts
- Admins are internal staff only
- Fixed hourly customer booking increments
- Pricing supports facility, day type, holiday, effective-date, and hourly schedule overrides
- Manual payment proof with staff verification is the production payment path until a gateway is selected
- Admin-assisted walk-in bookings create or reuse customer records
- Cancellation is allowed only for future confirmed bookings when policy and cancellation window permit it

## Post-MVP Recommendations

- Add a verified payment gateway when the provider is selected
- Add SMS notifications if operationally required
- Add server-side image decoding/re-encoding and metadata stripping
- Add webhook-driven payment confirmation and expiry handling
- Add refund tracking and staff workflows
- Add booking filters, pagination, and richer reporting
- Add email notifications and audit history
- Add multi-branch support if operations expand

## Architecture Notes

See [docs/architecture.md](docs/architecture.md) for the MVP architecture, schema direction, and core tradeoffs.
