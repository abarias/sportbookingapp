# Sport Booking PH

MVP sports facility booking app for Philippine operators. The app supports customer booking flows and internal admin operations for full basketball courts, half basketball courts, pickleball courts, and badminton courts.

## Current Status

Phase 6 is in place:

- Next.js App Router + TypeScript strict mode
- Tailwind CSS UI scaffold
- Prisma + PostgreSQL schema, migrations, and seed data
- Credentials auth for customer and admin accounts
- Database-backed facility browsing and availability
- Server-side booking creation with overlap checks
- Mock payment flow that auto-confirms bookings
- Customer booking history and cancellation flow
- Admin overview, facility management, blocked schedules, customers, and reports
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

These can be overridden with seed env vars in `.env`.

## Environment Variables

Defined in `.env.example`:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `PAYMONGO_SECRET_KEY`
- `PAYMONGO_PUBLIC_KEY`
- `PAYMONGO_WEBHOOK_SECRET`
- `APP_TIMEZONE`
- `PAYMENT_HOLD_MINUTES`
- `NEXT_PUBLIC_APP_NAME`
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`
- `SEED_CUSTOMER_EMAIL`
- `SEED_CUSTOMER_PASSWORD`

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

4. Optionally seed an initial admin account from a secure environment.
5. Deploy the Next.js app to Vercel.

Production notes:

- Keep `NEXTAUTH_SECRET` unique per environment.
- Use a strong production database password.
- Mock payment is still enabled in this MVP and should be disabled or replaced before launch.
- Refund handling is still manual.

## Assumptions

- Single branch/location only
- Customers use email/password accounts
- Admins are internal staff only
- Fixed 30-minute slot increments
- Pricing is per facility without peak/off-peak tiers
- Mock payment is temporary until a real gateway is chosen
- Cancellation is allowed only for future confirmed bookings when policy permits it

## Post-MVP Recommendations

- Replace mock payments with verified PayMongo or another gateway
- Add webhook-driven payment confirmation and expiry handling
- Add refund tracking and staff workflows
- Add booking filters, pagination, and richer reporting
- Add email notifications and audit history
- Add multi-branch support if operations expand

## Architecture Notes

See [docs/architecture.md](docs/architecture.md) for the MVP architecture, schema direction, and core tradeoffs.
