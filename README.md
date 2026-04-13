# Sport Booking PH

MVP sports facility booking app for Philippine operators. The product supports customer booking flows and admin operations for whole basketball courts, half basketball courts, pickleball courts, and badminton courts.

## Current Status

Phase 3 is in place:

- Next.js App Router scaffold
- TypeScript strict mode
- Tailwind CSS baseline
- lean domain-oriented folder structure
- Prisma schema and seed script
- credentials auth for customer and admin accounts
- protected admin route and customer login/register pages
- database-backed facility browsing
- date-based availability view with 30-minute slots
- server-validated pending booking creation
- real customer bookings page backed by PostgreSQL
- architecture and schema proposal in `docs/architecture.md`

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma
- NextAuth
- PayMongo
- Vercel

## Local Development

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL locally. Example with Docker:

```bash
docker run --name sportbookingapp-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=sportbookingapp \
  -p 5432:5432 \
  -d postgres:16
```

3. Install dependencies:

```bash
npm install
```

4. Generate Prisma client and apply the initial migration:

```bash
npm run db:generate
npx prisma migrate dev --name init
```

5. Seed sample data:

```bash
npm run db:seed
```

6. Start the dev server:

```bash
npm run dev
```

7. Validate the codebase:

```bash
npm run typecheck
npm run lint
npm run build
```

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

## Project Structure

```text
src/
  app/          Route entry points and layouts
  components/   Shared UI and layout primitives
  features/     Domain-facing feature modules
  lib/          Utilities, config, formatting, validation
  server/       Server-only business orchestration
docs/           Architecture and planning docs
prisma/         Schema, migration, and seed data
```

## MVP Assumptions

- Single venue/branch only for MVP.
- Customers use email/password accounts.
- Admins are internal staff users with role-based access.
- Fixed 30-minute slot increments.
- Bookings are only confirmed after verified payment success.
- Pricing is facility-based for MVP, without peak/off-peak tiers yet.
- Refunds are manual/off-platform for MVP.

## Seeded Accounts

- Admin: `admin@sportbooking.local` / `Admin12345!`
- Customer: `player@sportbooking.local` / `Player12345!`

These can be overridden through the seed env vars in `.env`.

## Next Phases

1. PayMongo checkout and webhook confirmation
2. Admin management pages and reporting
3. Tests, deployment guide, and polish
