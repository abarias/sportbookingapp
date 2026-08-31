# MMG Stellar UAT Field Guide

Standalone, static user-acceptance testing documentation generated from repository evidence at commit `6363c3a` on branch `uat-testing`.

The portal contains 74 unique scenarios, including 20 Customer, 22 Super Admin, 7 Receptionist, 8 Booking Admin, 5 Social Media Person, 8 cross-role, and 4 general responsive/accessibility/reliability cases. A documented scenario is not considered verified until a tester records a result.

## Repository Findings

- Customer authentication uses email/password plus a six-digit email verification code sent through Resend. The mobile number is captured, but SMS OTP is not implemented.
- Customer bookings use hourly increments from one to four hours; availability retains 30-minute internal resolution.
- `Reserve & Pay` creates a 15-minute hold. Proof submission stops expiry but does not confirm the booking. An authorized admin must verify it.
- Pricing is server-authoritative, rule-based, stored in integer minor units, and displayed as VAT-exclusive base pricing.
- PostgreSQL exclusion constraints protect active booking and reschedule replacement ranges.
- Super Admin, Receptionist, Booking Admin, and Social Media Person are seeded role templates backed by stable permissions.
- Customer self-service rescheduling, check-in, and a report-export interface are not implemented.
- Existing README/architecture passages describing mobile OTP and older mock behavior are stale.
- The customer bookings page may read global cancellation settings under reversed variables. `CUST-NEG-003` must be executed before accepting cancellation behavior.
- Vitest domain/unit coverage exists; Playwright/Cypress E2E coverage does not.

See **Known Gaps and Questions** inside the portal for evidence paths and business decisions.

## Run Locally

No dependency installation is required.

```bash
cd uat-guide
npm run verify
npm run dev
```

Open `http://127.0.0.1:4173`.

To test the exact production output:

```bash
npm run build
npm run preview
```

Open `http://127.0.0.1:4174`.

## Progress Storage

Test status, notes, evidence checks, tester names, dates, account aliases, and run metadata are stored in `localStorage` in the current browser only.

- Export JSON after every session for backup or transfer.
- Import accepts only the same guide version and known test IDs.
- CSV is intended for spreadsheet consolidation.
- Reset local progress requires confirmation.
- This portal is not a shared multi-user test-management system.

## Screenshots

`assets/screenshots/manifest.json` lists every requested screenshot at desktop (`1440x1000`) and mobile (`390x844`) viewports. Entries remain marked `placeholder` until an authorized tester captures and reviews them.

The capture script is intentionally read-only: it signs in and visits pages but does not create bookings, upload proof, send notifications, or change data. Dynamic booking/payment screenshots require existing synthetic UAT record IDs.

Playwright is not part of the application or guide dependency tree. If the project owner approves this documentation-only tool:

```bash
cd uat-guide
npm install --no-save playwright
```

Set only synthetic UAT account variables in your local shell, never in source control:

```bash
export UAT_APP_URL="https://your-designated-uat-app.example"
export UAT_FACILITY_SLUG="uat-facility"
export UAT_BOOKING_ID="synthetic-booking-id"
export UAT_PAYMENT_ID="synthetic-payment-id"
export UAT_CUSTOMER_EMAIL="uat-customer@example.test"
export UAT_CUSTOMER_PASSWORD="provided-securely"
export UAT_SUPER_ADMIN_EMAIL="uat-super-admin@example.test"
export UAT_SUPER_ADMIN_PASSWORD="provided-securely"
export UAT_RECEPTIONIST_EMAIL="uat-receptionist@example.test"
export UAT_RECEPTIONIST_PASSWORD="provided-securely"
export UAT_BOOKING_ADMIN_EMAIL="uat-booking-admin@example.test"
export UAT_BOOKING_ADMIN_PASSWORD="provided-securely"
export UAT_SOCIAL_MEDIA_EMAIL="uat-social-media@example.test"
export UAT_SOCIAL_MEDIA_PASSWORD="provided-securely"
npm run screenshots
```

Review every generated image before changing its manifest status. Never capture real customer names, emails, phone numbers, payment references, or receipt images.

## Print and PDF

Use the **Printable / PDF Views** section to open complete or persona-specific layouts, then print from the browser.

Chrome/Edge automation is dependency-free:

```bash
cd uat-guide
npm run pdf
```

Generated files are written to `output/pdf/`:

- `complete-uat-guide.pdf`
- `customer-uat-guide.pdf`
- `super-admin-uat-guide.pdf`
- `receptionist-uat-guide.pdf`
- `booking-admin-uat-guide.pdf`
- `social-media-uat-guide.pdf`

If Chrome is not in a standard location, set `UAT_CHROME_PATH` to a Chromium-compatible executable. Generated PDFs must be visually reviewed before distribution.

## Deploy as a Separate Vercel Project

1. Create a new Vercel project from this repository. Do not reuse the sports application project.
2. Set **Root Directory** to `uat-guide`.
3. Set **Framework Preset** to `Other`.
4. Build command is `npm run build`.
5. Output directory is `dist`.
6. No environment variables are required for the static portal.
7. Deploy, then map a documentation-only subdomain such as `uat-guide.example.com`.
8. At the DNS provider, add the CNAME target supplied by Vercel and wait for verification/SSL issuance.
9. Consider Vercel Deployment Protection because the guide describes operational and permission workflows, even though it contains no credentials.

The screenshot capture variables belong only in the operator's local shell and must not be configured on the static guide project.

## Updating the Guide

1. Re-run repository discovery after routes, permissions, status transitions, pricing, validation, or policies change.
2. Update `data/discovery.js` and the relevant `data/cases-*.js` file.
3. Keep existing test IDs stable. Add a new ID when behavior is materially different.
4. Run `npm run manifest` after changing screenshot references.
5. Run `npm run verify`, `npm run build`, browser checks, and PDF generation.
6. Update `version`, `assessedCommit`, and `assessedBranch` in `data/discovery.js`.

## Safe Repeatable Data

- Prefix names, facilities, holidays, roles, notes, and references with `UAT-`.
- Allocate unique date/time ranges per tester.
- Use synthetic receipt images marked `UAT TEST ONLY`.
- Do not run development seed against a shared/remote environment without explicit approval.
- Use approved UI cleanup where possible; database cleanup belongs to the environment owner.
- Do not reuse application runtime files under `public/uploads/` as documentation evidence.

## Verification Commands

```bash
npm run manifest
npm run verify
npm run build
npm run pdf
```

The root application can be validated independently with its existing commands:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The UAT guide does not modify production application behavior, database schema, dependencies, seed data, or infrastructure configuration.
