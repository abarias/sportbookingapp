# Architecture

## MVP Architecture

The app uses a Next.js App Router monolith with clean internal module boundaries:

- `src/app`: route entry points, layouts, pages, server actions, API/webhook routes
- `src/components`: reusable UI building blocks
- `src/features`: business-facing modules grouped by domain
- `src/lib`: cross-cutting utilities such as auth, db, env, money, time, and validation helpers
- `src/server`: server-only orchestration for bookings, payments, reporting, and policies
- `prisma`: schema, migrations, and seed data

This keeps deployment simple on Vercel while still separating UI, business logic, and persistence.

## Folder Structure

```text
src/
  app/
    (marketing)/
    (customer)/
    admin/
    api/
  components/
    ui/
    layout/
    shared/
  features/
    auth/
    facilities/
    bookings/
    payments/
    admin/
  lib/
    auth/
    db/
    env/
    time/
    validation/
  server/
    bookings/
    facilities/
    payments/
    reporting/
    policies/
prisma/
  schema.prisma
  seed.ts
docs/
```

## Booking Design

- Store all datetimes in UTC.
- Convert to `Asia/Manila` for display and slot generation.
- Slot interval is fixed at 30 minutes for MVP.
- Availability is calculated from:
  - confirmed bookings
  - pending bookings within payment hold window
  - blocked schedules
  - facility operating hours
- Booking confirmation is driven by verified payment webhook events.
- Double-book prevention happens in two places:
  - optimistic UI disabling based on fetched availability
  - server-side transactional overlap validation before creating payment intent/session

## Payment Design

- Use PayMongo as the first provider.
- Keep a payment gateway interface so provider-specific logic stays behind `src/server/payments`.
- Booking state and payment state are separate.
- Customer redirect alone never confirms the booking.
- Webhook verification is the source of truth for payment success or failure.

## Auth Design

- Email/password auth for customers and admins.
- Single `User` table with a `role` field for MVP simplicity.
- Admin pages are protected by role checks in server components and middleware later.

## Reporting Design

- Reporting is derived from confirmed bookings and paid payments.
- MVP reporting pages will focus on daily bookings, revenue, and utilization summaries.

## Proposed Database Schema

### User

- `id`
- `email`
- `passwordHash`
- `role`
- `fullName`
- `phone`
- `createdAt`
- `updatedAt`

### Facility

- `id`
- `name`
- `slug`
- `description`
- `type`
- `isEnabled`
- `timezone`
- `slotIntervalMinutes`
- `cancellationEnabledOverride` (nullable)
- `createdAt`
- `updatedAt`

### FacilityImage

- `id`
- `facilityId`
- `url`
- `altText`
- `sortOrder`
- `createdAt`

### FacilityOperatingHour

- `id`
- `facilityId`
- `dayOfWeek`
- `opensAtMinutes`
- `closesAtMinutes`
- `isClosed`

### PricingRule

- `id`
- `facilityId`
- `currency`
- `amountMinor`
- `billingMode`
- `minimumMinutes`
- `createdAt`
- `updatedAt`

### Booking

- `id`
- `userId`
- `facilityId`
- `status`
- `startAtUtc`
- `endAtUtc`
- `timezone`
- `slotCount`
- `amountMinor`
- `currency`
- `paymentHoldExpiresAt`
- `cancellationReason` (nullable)
- `cancelledAt` (nullable)
- `createdAt`
- `updatedAt`

### Payment

- `id`
- `bookingId`
- `provider`
- `providerReference`
- `checkoutUrl`
- `status`
- `amountMinor`
- `currency`
- `paidAt`
- `expiresAt`
- `rawPayload` (JSON)
- `createdAt`
- `updatedAt`

### BlockedSchedule

- `id`
- `facilityId`
- `title`
- `reason`
- `startAtUtc`
- `endAtUtc`
- `createdByUserId`
- `createdAt`
- `updatedAt`

### AppSetting

- `id`
- `key`
- `value`
- `updatedAt`

## Tradeoffs

- A single app and database keep MVP delivery fast and hosting costs low.
- Role-based auth is simpler than separate admin/customer auth systems.
- Pricing rules stay intentionally simple at launch: one main active rate per facility.
- Booking uses direct `startAtUtc`/`endAtUtc` storage instead of a child `BookingSlot` table because fixed 30-minute intervals make range checks simpler.
- Refund automation is intentionally out of scope for MVP even though payment states are future-ready.

## Implementation Phases

1. Scaffold app, core architecture, shared UI, typed utilities.
2. Add Prisma schema, auth, seed data, and local setup.
3. Build customer browsing, availability, booking creation, and booking history.
4. Add PayMongo checkout flow and webhook-driven confirmation.
5. Add admin dashboard, facility management, blocking, pricing, and reporting.
6. Add validation hardening, tests, polish, and deployment docs.
