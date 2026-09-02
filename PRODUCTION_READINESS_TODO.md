# Production Readiness Assessment

> Reassessed on 2026-08-28 against branch `production-readiness-hardening`. Completed checkboxes reflect repository evidence; external Vercel/Supabase controls remain open until manually verified.

## 1. Executive Summary

The application has progressed beyond the original MVP assessment. It now has verified-email registration through Resend, server-side booking and dynamic-pricing validation, PostgreSQL overlap constraints, idempotent booking/order creation, staff-approved manual payment proof, automatic hold expiration, durable Supabase Storage support, configurable RBAC, audit logs, administrative rescheduling, consolidated booking orders, and substantially broader automated tests.

The most serious remaining repository-visible risks are incomplete abuse protection outside registration, unresolved high-severity Prisma toolchain audit findings, incomplete file-content validation, no CI release gate, no explicit CSP/security-header policy, and limited production observability and health monitoring. Supabase backups, restore testing, Data API/RLS posture, least-privilege database access, and Vercel production controls remain external configuration requiring manual validation.

Areas that are reasonably mature for a controlled pilot include booking/payment state separation, server-authoritative prices and availability, database overlap guards, manual payment verification, booking/order expiration, granular admin permissions, auditability, and environment-specific deployment documentation. Production launch still requires security, release automation, monitoring, privacy, and recovery work.

**Recommended release-readiness status:** Ready only for controlled pilot after the remaining P0 repository controls and external Supabase/Vercel checklist are completed. Not ready for broad production.

## 2. Critical Release Blockers

- Rate limiting currently protects registration and email-verification flows, but not login, booking/cart checkout, cancellation, payment-proof upload, or sensitive admin mutations.
- `npm audit --omit=dev` on 2026-08-28 reports three high-severity findings in the Prisma configuration toolchain through `deepmerge-ts`; remediation or a documented build-only mitigation is required.
- Facility and payment-proof uploads use durable Supabase Storage in hosted environments, but validation still relies primarily on declared MIME type and size rather than file signatures and server-side image decoding/re-encoding.
- No CI/CD release gate runs lint, typecheck, tests, production audit, build, or migration validation.
- No explicit Content Security Policy or complete security-header policy is configured.
- No health/readiness endpoints, structured production error reporting, uptime alerts, or incident dashboards are represented in the repository.
- Supabase backups/PITR, restore testing, Data API exposure, RLS posture, least-privilege database credentials, and connection-pool settings require manual validation.

## 3. Prioritized TODO Backlog

### P0 — Critical

* [x] **Replace mock payment auto-confirmation with a verified production payment or staff-approved proof-of-payment workflow**

  * **Completion evidence (2026-08-28):** Manual proof submission and staff verification are implemented in `src/server/payments/service.ts`, `src/server/orders/service.ts`, `src/features/orders/actions.ts`, and `src/features/admin/actions.ts`. Customer bookings remain held until an authorized verifier approves payment; production environment validation blocks mock mode unless explicitly overridden.

  * **Priority:** P0
  * **Category:** Payment, Booking Integrity, Security
  * **Evidence:** `src/features/bookings/actions.ts:69-77` calls `createConfirmedBookingWithMockPayment`; `src/server/bookings/service.ts:314-472` creates `BookingStatus.CONFIRMED` and `PaymentStatus.PAID` using `PaymentProvider.MOCK`; `prisma/seed.ts:214-216` enables `payments.mockAutoConfirmEnabled`; `README.md:189-190` says mock payment is still enabled.
  * **Problem:** A customer can create a confirmed paid booking without a real payment, payment proof review, gateway webhook, or staff approval.
  * **Production impact:** Revenue loss, fraudulent bookings, operational disputes, inaccurate reporting, and occupied inventory without payment.
  * **Recommended action:** Implement a production payment state machine. For gateway mode, create `PENDING_PAYMENT` bookings, create provider checkout sessions, verify webhooks, update booking/payment status idempotently, and expire unpaid holds. If using manual proof-of-payment first, store private proof files, require admin review, and only confirm after approval.
  * **Acceptance criteria:** Customer bookings cannot become `CONFIRMED` unless a verified gateway event or authorized admin approval is recorded; mock mode is disabled in production by env validation; tests cover success, failure, duplicate webhook/proof submission, and expired hold paths.
  * **Dependencies:** Payment provider decision or manual proof workflow; durable private storage.
  * **Estimated effort:** XL
  * **Release blocker:** Yes

* [x] **Replace browser-displayed mock OTP with production email verification and secure verification lifecycle controls**

  * **Completion evidence (2026-08-28):** The product decision changed from SMS OTP to email verification. Resend delivery, hashed verification tokens, expiry, attempt limits, resend throttling, honeypot handling, and cleanup are implemented in `src/features/auth/actions.ts`, `src/lib/notifications/email.ts`, `src/server/auth/cleanup.ts`, and migration `20260807003000_add_email_verification_and_registration_attempts`.

  * **Priority:** P0
  * **Category:** Authentication, Security, Privacy
  * **Evidence:** `src/features/auth/actions.ts:64-88` generates `devOtp` and returns it to the client; `src/components/auth/register-form.tsx:35-36` displays `Development code`; `README.md:115-117` documents mock OTP; `src/features/auth/actions.ts:128-132` increments attempts but never caps them.
  * **Problem:** OTP identity verification is not real; codes are exposed to users and brute-force attempts are not blocked.
  * **Production impact:** Fake account verification, account abuse, phone-number spam if SMS is later added without controls, and weak customer identity assurance.
  * **Recommended action:** Integrate an SMS provider, never return OTPs to the browser, cap attempts, enforce resend cooldowns, expire old codes, add per-phone/per-IP registration throttles, and store delivery metadata.
  * **Acceptance criteria:** OTP is delivered only via provider; no OTP appears in HTML, JSON, logs, or action state; max attempts and resend limits are enforced and tested; invalid/expired attempts produce generic messages.
  * **Dependencies:** SMS provider account and sender policy.
  * **Estimated effort:** L
  * **Release blocker:** Yes

* [x] **Add rate limiting and abuse prevention for auth, verification, booking, admin mutation, and upload paths**

  * **Completion evidence (2026-08-28):** `RateLimitBucket`, `src/lib/security/rate-limit.ts`, and centralized policies enforce atomic per-IP/user/email limits for login, direct booking, consolidated checkout, cancellation, proof uploads, walk-ins, payment decisions, facility/pricing/holiday changes, RBAC changes, and rescheduling. Registration retains its dedicated email/IP attempt controls. The cron removes expired buckets and strict production validation prevents disabling limits.

  * **Priority:** P0
  * **Category:** Security, Reliability
  * **Evidence:** `src/auth.ts:23-46` credentials login has no throttling; `src/features/auth/actions.ts:23-154` register/OTP actions have no rate limits; `src/features/bookings/actions.ts:43-119` booking/cancel actions have no rate limits; `src/features/admin/actions.ts:134-551` admin mutation actions have no rate limits; no middleware/rate-limit module is present in `src/`.
  * **Problem:** High-risk mutations can be brute-forced or spammed.
  * **Production impact:** Account guessing, OTP brute force, booking inventory abuse, database load spikes, SMS cost blowups, and admin endpoint abuse if credentials are compromised.
  * **Recommended action:** Add server-side rate limits backed by Redis/Vercel KV/Upstash or a database table; apply per-IP, per-account, per-phone, and per-action policies; add bot protection for registration if abuse occurs.
  * **Acceptance criteria:** Login, registration, OTP verify/resend, booking create/cancel, walk-in creation, facility uploads, and block schedule mutations reject excessive attempts with tested limits and operational metrics.
  * **Dependencies:** Rate-limit backing store.
  * **Estimated effort:** L
  * **Release blocker:** Yes

* [x] **Add database-level booking and blocked-schedule overlap protection**

  * **Completion evidence (2026-08-28):** Migration `20260815134500_add_booking_overlap_guards` installs `btree_gist` and exclusion constraints for active booking and blocked-schedule ranges. Booking, order checkout, walk-in, and rescheduling services use the centralized availability rules and transaction safeguards.

  * **Priority:** P0
  * **Category:** Booking Integrity, Database
  * **Evidence:** `prisma/schema.prisma:144-167` defines `Booking` indexes but no exclusion constraint; `prisma/schema.prisma:188-202` defines `BlockedSchedule` indexes but no overlap constraint; app-only overlap checks appear in `src/server/bookings/service.ts:230-287` and `src/server/bookings/service.ts:380-437`.
  * **Problem:** Double-booking prevention depends on application logic and serializable Prisma transactions only.
  * **Production impact:** Concurrent requests, direct database writes, manual repairs, or transaction configuration mistakes can create overlapping confirmed bookings or blocks.
  * **Recommended action:** Add PostgreSQL `btree_gist` and exclusion constraints for active inventory ranges, or implement an explicit slot inventory table with unique `(facilityId, slotStartUtc)` rows. Include active statuses only where appropriate.
  * **Acceptance criteria:** The database rejects overlapping `CONFIRMED` bookings and valid unexpired holds; blocked schedules cannot conflict with confirmed bookings without an explicit audited override; tests prove concurrent inserts cannot double-book.
  * **Dependencies:** Data cleanup migration; decision on pending hold treatment.
  * **Estimated effort:** L
  * **Release blocker:** Yes

* [x] **Make booking creation idempotent and duplicate-submission safe**

  * **Completion evidence (2026-08-28):** `Booking.idempotencyKey`, `BookingOrder.idempotencyKey`, and `BookingReschedule.idempotencyKey` are unique. Direct booking, consolidated checkout, and rescheduling services return existing results for retried keys and have regression tests.

  * **Priority:** P0
  * **Category:** Booking Integrity, Reliability
  * **Evidence:** `src/features/bookings/actions.ts:43-78` accepts form posts without an idempotency key; `src/server/bookings/service.ts:441-467` creates a booking/payment with `providerReference` based on `Date.now()` and user id prefix.
  * **Problem:** Browser retries, double clicks, network retries, or server action replay can create duplicate bookings when each request passes availability.
  * **Production impact:** Duplicate charges, duplicate reservations, customer disputes, and inventory inconsistency.
  * **Recommended action:** Generate a one-time idempotency key per booking intent, persist it with user/facility/time/amount, and make booking/payment creation idempotent at the database layer.
  * **Acceptance criteria:** Replaying the same booking request returns the same booking/payment result; separate requests for the same slot cannot both succeed; tests cover retry and double-click scenarios.
  * **Dependencies:** Booking intent table or idempotency-key column.
  * **Estimated effort:** M
  * **Release blocker:** Yes

* [x] **Move facility uploads to durable object storage with strict file validation**

  * **Priority:** P0
  * **Category:** Security, File Uploads, Reliability
  * **Completion evidence (2026-08-30):** `src/lib/storage/validated-image.ts` decodes uploads with Sharp, rejects unsupported or oversized images, enforces a 40MP pixel limit, rotates according to metadata, resizes to a bounded maximum, strips metadata, and re-encodes to WebP. `src/lib/storage/facility-images.ts` and `src/lib/storage/payment-proofs.ts` use Supabase Storage in hosted environments and refuse Vercel filesystem fallback. Focused tests cover valid content with spoofed MIME, invalid bytes, and the 5MB limit.
  * **Problem:** Application-level upload validation and durable hosted storage are now implemented. External bucket policies and lifecycle controls still require separate validation.
  * **Production impact:** Misconfigured storage could expose proofs or create uncontrolled storage costs.
  * **Recommended action:** Complete the separate hosted-storage validation task below before production use.
  * **Acceptance criteria:** Application uploads are decoded, bounded, normalized, and stored durably in hosted environments; local fallback is limited to development; focused tests pass.
  * **Dependencies:** Sharp dependency and Supabase Storage configuration.
  * **Estimated effort:** L
  * **Release blocker:** Yes

* [ ] **Validate hosted storage policies and lifecycle controls**

  * **Priority:** P0
  * **Category:** Security, File Uploads, Privacy, DevOps
  * **Evidence:** `src/lib/storage/payment-proofs.ts` uses a private-bucket signed-URL flow and `src/lib/storage/facility-images.ts` uses public URLs, but Supabase bucket policies, lifecycle limits, quotas, malware scanning, and cleanup execution are not stored in this repository.
  * **Problem:** The application cannot prove that hosted storage is configured with the intended privacy and retention boundaries.
  * **Production impact:** Payment proofs could be publicly exposed, or uploaded media could grow without cost and retention controls.
  * **Recommended action:** Validate each environment's buckets, service-role access, anonymous access behavior, quotas, retention, and object cleanup process; record evidence in the operations runbook.
  * **Acceptance criteria:** Payment proofs cannot be accessed anonymously; facility images are intentionally public; upload/replacement tests pass in staging; retention and cleanup ownership are documented.
  * **Dependencies:** Supabase project access and staging deployment.
  * **Estimated effort:** M
  * **Release blocker:** Yes

* [x] **Upgrade or mitigate vulnerable production and auth dependencies**

  * **Completion evidence (2026-08-28):** Framework/auth packages were upgraded earlier. The remaining Prisma configuration advisory is mitigated with an npm override to patched `deepmerge-ts` 8.x, following the Prisma upstream issue's documented downstream workaround. `npm audit` reports zero vulnerabilities and Prisma 6 generation remains successful; remove the override when Prisma ships the patched dependency directly.

  * **Priority:** P0
  * **Category:** Security, DevOps
  * **Evidence:** `package.json:19-39` uses `next`, `next-auth`, `@auth/prisma-adapter`, `postcss`, `vitest`; `npm audit --json` on 2026-07-26 reports 12 vulnerabilities: 3 critical, 7 high, 2 low, including critical `next-auth`/`@auth/core` and high `next` advisories.
  * **Problem:** Known vulnerable framework/auth packages are installed.
  * **Production impact:** Potential authentication bypass/fail-open behavior, denial of service, SSRF, XSS, cache poisoning, or disclosure depending on advisory exploitability.
  * **Recommended action:** Upgrade `next`, `next-auth`/Auth.js packages, `postcss`, `sharp`, `vitest`, and transitive packages to patched versions; run regression tests; pin lockfile; repeat audit in CI.
  * **Acceptance criteria:** `npm audit --omit=dev` has no high/critical production vulnerabilities; any remaining dev-only advisories are documented with mitigation; auth and booking smoke tests pass after upgrade.
  * **Dependencies:** Framework/auth compatibility testing.
  * **Estimated effort:** M
  * **Release blocker:** Yes

* [x] **Add fail-fast production environment validation**

  * **Completion evidence (2026-08-28):** `src/lib/config/env.ts` validates production database URLs, HTTPS auth URL, strong secrets, Resend configuration, cron secret, payment mode, and gateway credentials. `next.config.ts` runs validation during build/startup.

  * **Priority:** P0
  * **Category:** DevOps, Security, Reliability
  * **Evidence:** Env vars are documented in `.env.example:1-12`, but runtime reads use fallback values in `src/server/bookings/service.ts:30`, `src/server/admin/calendar.ts:79`, `src/features/admin/actions.ts:350`, and `src/app/admin/walk-ins/page.tsx:17`; no `src/lib/env` validation module exists.
  * **Problem:** The app can run with missing, placeholder, or unsafe production values.
  * **Production impact:** Auth instability, accidental mock mode, wrong timezone, weak secrets, failed database access, or unsafe demo credentials in production.
  * **Recommended action:** Add Zod-based env validation loaded at server startup; require strong `NEXTAUTH_SECRET`, production `DATABASE_URL`, `NEXTAUTH_URL`, app timezone, upload provider config, SMS/payment configs when enabled, and explicitly reject mock OTP/payment in production.
  * **Acceptance criteria:** Production build/runtime fails with clear errors for missing/placeholder secrets; development keeps safe defaults; tests cover env validation.
  * **Dependencies:** Payment/SMS mode design.
  * **Estimated effort:** M
  * **Release blocker:** Yes

* [x] **Remove seeded/default credentials from production bootstrap**

  * **Completion evidence (2026-08-28):** Development seed defaults are restricted to local databases, while `scripts/bootstrap-admin.ts` provides explicit production admin creation with required secure credentials.

  * **Priority:** P0
  * **Category:** Authentication, DevOps
  * **Evidence:** `.env.example:10-12` documents seeded `admin@sportbooking.local` / `Admin12345!`; `prisma/seed.ts:103-116` falls back to those values; `prisma/seed.ts:324-326` prints credentials to logs; `README.md:69-72` documents the credentials.
  * **Problem:** Production seeding can create well-known admin/customer credentials and log them.
  * **Production impact:** Account compromise if seed runs against production or logs are accessible.
  * **Recommended action:** Split dev seed from production bootstrap; require explicit secure admin creation for production; never print passwords; force password rotation on first login; document production admin onboarding.
  * **Acceptance criteria:** Running production seed cannot create known passwords; seed logs never contain passwords; production bootstrap is tested and documented.
  * **Dependencies:** Admin onboarding workflow.
  * **Estimated effort:** S
  * **Release blocker:** Yes

* [x] **Implement audit logging for security- and booking-sensitive actions**

  * **Completion evidence (2026-08-28):** `AuditLog` and `src/lib/audit/log.ts` are used by RBAC, facilities, pricing, walk-ins, payment review, rescheduling, cart/order checkout, and expiration paths. Security-table migrations enforce append-only/direct-access protections.

  * **Priority:** P0
  * **Category:** Security, Observability, Compliance
  * **Evidence:** `prisma/schema.prisma:47-209` has no audit/event table; admin mutations in `src/features/admin/actions.ts:134-551` update settings/facilities/blocks/walk-ins without audit records; booking/cancel actions in `src/features/bookings/actions.ts:43-119` have no audit trail.
  * **Problem:** There is no tamper-resistant history of who changed bookings, prices, facilities, blocks, cancellation settings, or customer data.
  * **Production impact:** Disputes and incident investigations cannot be resolved reliably; admin misuse may go undetected.
  * **Recommended action:** Add `AuditEvent` table with actor id, role, action, entity type/id, before/after metadata, request metadata, and timestamp; write events inside the same transaction as mutations where feasible.
  * **Acceptance criteria:** Facility changes, pricing changes, blocked schedules, walk-ins, cancellations, payment/proof decisions, login security events, and admin setting changes create queryable audit events; tests verify audit write atomicity.
  * **Dependencies:** Request metadata strategy.
  * **Estimated effort:** L
  * **Release blocker:** Yes

* [x] **Implement automatic expiration for unpaid pending bookings**

  * **Completion evidence (2026-08-28):** Secured route `src/app/api/cron/expire-bookings/route.ts` expires standalone holds, consolidated orders, and rescheduling holds idempotently. README documents Vercel Cron and `CRON_SECRET` setup.

  * **Priority:** P0
  * **Category:** Booking Integrity, Reliability
  * **Evidence:** `BookingStatus.EXPIRED` exists in `prisma/schema.prisma:22-27`; `paymentHoldExpiresAt` exists in `prisma/schema.prisma:155`; availability ignores expired holds through `src/server/bookings/service.ts:90-98`; no cron/job route exists in `src/app/api`; README mentions pending unpaid bookings expire but no scheduled implementation is present.
  * **Problem:** Expired pending bookings are only ignored by availability queries; records are not transitioned to `EXPIRED`.
  * **Production impact:** Admin views and reports may show stale pending bookings; payment reconciliation and customer messaging become confusing.
  * **Recommended action:** Add a secured Vercel Cron/API job that marks expired pending bookings and payments as `EXPIRED`, records audit events, and is idempotent.
  * **Acceptance criteria:** Expired pending bookings transition automatically; repeated job runs are safe; admin dashboards distinguish pending vs expired correctly; tests cover expiry boundaries.
  * **Dependencies:** Cron secret and deployment configuration.
  * **Estimated effort:** M
  * **Release blocker:** Yes

* [ ] **Validate Supabase production security, RLS posture, backups, and connection mode**

  * **Priority:** P0
  * **Category:** Database, DevOps, Security
  * **Evidence:** Repository uses direct Prisma database access via `prisma/schema.prisma:5-8`; no Supabase policies, SQL RLS files, backup config, or database grants are present in the repo; production DB settings are external configuration not visible in repository.
  * **Problem:** Database access controls, backup policy, restore readiness, and connection pooling cannot be verified from code.
  * **Production impact:** Data exposure, data loss, or runtime transaction failures if production is misconfigured.
  * **Recommended action:** Document and validate Supabase project settings: backups/PITR, restricted credentials, no public table access unless intentionally using Supabase APIs, pooler/session mode for Prisma transactions, SSL, least-privilege DB user, and rotation process.
  * **Acceptance criteria:** A production DB checklist is completed with screenshots/exports where possible; restore test is performed; credentials are rotated; application uses a least-privilege connection string compatible with Prisma transactions.
  * **Dependencies:** Supabase project access.
  * **Estimated effort:** M
  * **Release blocker:** Yes

### P1 — High

* [x] **Add CI/CD release gates**

  * **Completion evidence (2026-08-28):** `.github/workflows/quality-gates.yml` runs locked installation, production dependency audit, Prisma validation/generation, typecheck, lint, tests, and production build for pull requests and promotion branches. Repository branch protection must still be configured externally to require this check.

  * **Priority:** P1
  * **Category:** CI/CD, Testing, DevOps
  * **Evidence:** `find .github` returns no workflow directory; scripts exist in `package.json:6-17` but are not automated.
  * **Problem:** Typecheck, lint, tests, audit, build, and migration validation are manual.
  * **Production impact:** Broken or vulnerable code can be merged/deployed unnoticed.
  * **Recommended action:** Add GitHub Actions for install, lint, typecheck, test, `prisma validate`, build, audit, and optional preview deployment checks.
  * **Acceptance criteria:** Pull requests and `main` pushes run required checks; high/critical production vulnerabilities fail CI; failed migrations block deploy.
  * **Dependencies:** GitHub Actions secrets and branch protection.
  * **Estimated effort:** M
  * **Release blocker:** No

* [x] **Add security headers and a staged CSP strategy**

  * **Completion evidence (2026-08-28):** `next.config.ts` applies nosniff, frame denial, strict referrer, permissions, cross-origin opener, and production HSTS headers. `src/lib/security/headers.ts` provides a report-only CSP for staging validation. Moving CSP to nonce-based enforcement remains a documented follow-up after violation review.

  * **Priority:** P1
  * **Category:** Security
  * **Evidence:** `next.config.ts:1-20` configures image domains only; no `headers()` function or CSP is defined.
  * **Problem:** The app relies on platform defaults and lacks explicit defense-in-depth headers.
  * **Production impact:** Increased XSS/clickjacking/content-sniffing exposure.
  * **Recommended action:** Configure `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`, and review Next/Image remote domains.
  * **Acceptance criteria:** Security headers are present in production responses; CSP supports required image/SMS/payment providers without unsafe broad origins; header tests pass.
  * **Dependencies:** Final vendor domains.
  * **Estimated effort:** M
  * **Release blocker:** No

* [x] **Add fine-grained admin roles and least-privilege permissions**

  * **Completion evidence (2026-08-28):** Normalized roles, permissions, role assignments, protected Super Admin rules, centralized `requirePermission` enforcement, RBAC management screens, audit history, and deny-by-default database policies are implemented and tested.

  * **Priority:** P1
  * **Category:** Authorization, Privacy
  * **Evidence:** `prisma/schema.prisma:10-13` has only `CUSTOMER` and `ADMIN`; `requireAdminSession` in `src/lib/auth/session.ts:19-31` grants all admin pages/actions to any admin.
  * **Problem:** Every admin can manage pricing, facilities, customer PII, reports, blocks, and walk-ins.
  * **Production impact:** Excessive privilege increases blast radius of compromised or junior staff accounts.
  * **Recommended action:** Add admin permission scopes/roles such as owner, manager, front desk, reports-only; enforce checks in actions and pages.
  * **Acceptance criteria:** Each admin route/action declares required permission; tests prove unauthorized admin roles cannot mutate restricted resources.
  * **Dependencies:** Operational role definitions.
  * **Estimated effort:** L
  * **Release blocker:** No

* [ ] **Improve session policy, admin re-authentication, and account lifecycle controls**

  * **Priority:** P1
  * **Category:** Authentication, Security
  * **Evidence:** `src/auth.ts:9-12` sets JWT session strategy only; no explicit max age, password reset, account lockout, forced password reset, or admin MFA appears in repository.
  * **Problem:** Production account lifecycle/security controls are incomplete.
  * **Production impact:** Long-lived stolen sessions and weak admin credential recovery processes increase compromise risk.
  * **Recommended action:** Define session max age/update age, password reset flow, optional admin MFA, account lockout/risk controls, and admin re-authentication for destructive actions.
  * **Acceptance criteria:** Session expiration is documented/tested; admin sensitive actions require recent auth or MFA; password reset and lockout behavior are covered by tests.
  * **Dependencies:** Email/SMS provider.
  * **Estimated effort:** L
  * **Release blocker:** No

* [ ] **Add durable notification system for booking and admin events**

  * **Priority:** P1
  * **Category:** API Integrations, Reliability
  * **Evidence:** README says SMS/email notifications are future work at `README.md:115-117` and `README.md:213-216`; no notification module or delivery table exists in `src/` or `prisma/schema.prisma`.
  * **Problem:** Customers and staff receive no reliable out-of-band confirmation, cancellation, expiry, or payment status notifications.
  * **Production impact:** Missed bookings, disputes, support load, and poor operational visibility.
  * **Recommended action:** Add notification provider abstraction, `NotificationDelivery` table, templates, retry handling, delivery status tracking, and cost limits.
  * **Acceptance criteria:** Booking confirmed/cancelled/expired and admin-created walk-in events enqueue notifications; failures are visible and retryable; tests cover provider failure.
  * **Dependencies:** SMS/email vendors.
  * **Estimated effort:** L
  * **Release blocker:** No

* [ ] **IMPORTANT: Design a customer-safe payment-proof resubmission and dispute workflow**

  * **Priority:** P1
  * **Category:** Payment, Booking Integrity, Customer Support, UX
  * **Evidence:** `PaymentStatus.ACTION_REQUIRED` and staff review notes already support requesting clearer or corrected proof, but there is no documented resubmission SLA, reminder flow, dispute case, or recovery policy for customers who may have already paid.
  * **Problem:** A new-proof request can leave a customer uncertain about how long they have to respond. Automatically expiring the booking or rejecting the payment after an arbitrary deadline could create avoidable disputes, especially when the bank transfer succeeded but the uploaded evidence was unclear.
  * **Recommended action:** Keep the original inventory hold deadline separate from proof remediation. If proof was submitted before the original hold expired, move the payment to `ACTION_REQUIRED` and do not silently forfeit the customer's payment claim because a replacement proof was not uploaded quickly. Show the exact staff reason, provide a resubmit action, send reminders, and route non-response to a visible support/reconciliation queue. If inventory must eventually be released, mark the booking/order as released-pending-payment-review rather than deleting the payment trail; after payment is verified, offer restoration to the original slot when available, an equivalent replacement slot, or a refund/escalation according to a published policy. Any hard deadline should be a clearly disclosed operational escalation deadline with reminders and a support override, not an automatic loss of a verified payment.
  * **Acceptance criteria:** Customers see the request reason, submission history, next action, and support contact; reminders are retry-safe and auditable; original hold expiry and proof-remediation state are modeled independently; a late or corrected proof remains reviewable; staff can extend, restore, reassign, or refund with an audit trail; tests cover successful resubmission, no response, late proof after inventory release, duplicate proof, and payment verified after release.
  * **Dependencies:** Customer-support policy, payment reconciliation procedure, notification system, and explicit decision on restoration/refund authority.
  * **Estimated effort:** L
  * **Release blocker:** No

* [x] **Paginate and filter admin/customer queries**

  * **Completion evidence (2026-08-28):** Customer booking history, admin customers, admin users, audit logs, payment queue, and assignment histories use bounded pagination; major admin datasets include search and filtering.

  * **Priority:** P1
  * **Category:** Performance, Privacy, UX
  * **Evidence:** `src/server/admin/queries.ts:98-113` loads all customers and all nested bookings; `src/server/admin/queries.ts:119-139` loads 30 days of all bookings/facilities; `src/app/bookings/page.tsx:44-64` loads all user bookings.
  * **Problem:** Several queries are unbounded and expose broad datasets to each admin page load.
  * **Production impact:** Slow pages, high DB cost, timeouts, and unnecessary PII exposure as data grows.
  * **Recommended action:** Add pagination, search, date filters, facility filters, and selected columns; avoid loading full nested histories by default.
  * **Acceptance criteria:** Admin customers/bookings/reports load bounded result sets; pagination/search tests cover large datasets; PII displayed only where needed.
  * **Dependencies:** UX decisions for filters.
  * **Estimated effort:** M
  * **Release blocker:** No

* [ ] **Complete observability, structured logging, and error tracking**

  * **Repository progress (2026-08-28):** `src/lib/observability/logger.ts` provides JSON logging with sensitive-key redaction; readiness and scheduled maintenance emit structured events with correlation/count metadata. A hosted error tracker, log drain, dashboards, and alert rules still require external configuration and broader instrumentation.

  * **Priority:** P1
  * **Category:** Observability, Reliability
  * **Evidence:** `src/lib/db/prisma.ts:8-10` only configures Prisma error logging; no Sentry/Datadog/OpenTelemetry/request-id/error-boundary setup appears in `src/`; seed logs credentials in `prisma/seed.ts:324-326`.
  * **Problem:** Production failures cannot be traced reliably.
  * **Production impact:** Incidents take longer to detect and diagnose; sensitive data may be logged ad hoc.
  * **Recommended action:** Add structured app logs, request correlation, server action error reporting, Prisma error capture, client error boundary reporting, and sensitive-field redaction.
  * **Acceptance criteria:** Unhandled errors are captured with request/user context and no secrets; dashboard/alerts exist for error rate and booking failures.
  * **Dependencies:** Monitoring vendor.
  * **Estimated effort:** M
  * **Release blocker:** No

* [ ] **Complete uptime, health, and readiness monitoring**

  * **Repository progress (2026-08-28):** `/api/health` and `/api/readiness` provide safe no-store liveness/database checks with request correlation, and `docs/production-operations.md` defines monitor/alert expectations. External uptime monitors and alert delivery still require configuration and validation.

  * **Priority:** P1
  * **Category:** Reliability, DevOps
  * **Evidence:** No health route exists under `src/app/api`; deployment smoke checks are manual.
  * **Problem:** There is no automated way to verify app, database, auth, and storage readiness.
  * **Production impact:** Outages may go unnoticed until customers report them.
  * **Recommended action:** Add `/api/health` and `/api/readiness` with safe checks; monitor home, login, facility list, and booking critical path externally.
  * **Acceptance criteria:** Health endpoints return safe status without leaking internals; uptime monitor alerts configured; checks are documented.
  * **Dependencies:** Monitoring provider.
  * **Estimated effort:** S
  * **Release blocker:** No

* [ ] **Validate backup, restore, and disaster recovery readiness**

  * **Repository progress (2026-08-28):** `docs/production-operations.md` documents backup checks, quarterly isolated restore drills, reconciliation targets, RPO/RTO decisions, and incident handling. Supabase backup enablement and a completed restore drill remain external release conditions.

  * **Priority:** P1
  * **Category:** DevOps, Database, Documentation
  * **Evidence:** README deployment notes at `README.md:178-193` do not mention backups or restores; no infra docs for backup/PITR are present.
  * **Problem:** Data recovery is not defined.
  * **Production impact:** Booking/customer/payment history can be permanently lost or restored inconsistently.
  * **Recommended action:** Configure managed DB backups/PITR, document RPO/RTO, test restore to staging, and define who approves recovery.
  * **Acceptance criteria:** Restore test completed and documented; backup status monitored; recovery steps are executable by support/engineering.
  * **Dependencies:** Supabase plan/settings.
  * **Estimated effort:** M
  * **Release blocker:** No

* [x] **Add release rollback and migration recovery strategy**

  * **Completion evidence (2026-08-28):** `docs/production-operations.md` defines schema-before-code deployment, Vercel application rollback, additive forward-fix migrations, data-corruption response, and explicitly prohibits destructive production reset.

  * **Priority:** P1
  * **Category:** DevOps, Reliability
  * **Evidence:** `package.json:14` has `db:deploy`, README uses `npx prisma migrate deploy` at `README.md:181-184`; no rollback procedure exists.
  * **Problem:** Failed deploys or migrations have no documented recovery path.
  * **Production impact:** Production downtime or broken data after faulty releases.
  * **Recommended action:** Define Vercel rollback procedure, migration compatibility rules, backup-before-migration step, and forward-fix process.
  * **Acceptance criteria:** Runbook exists; staging migration drill completed; releases include rollback notes.
  * **Dependencies:** CI/CD and staging.
  * **Estimated effort:** M
  * **Release blocker:** No

* [ ] **Add payment/webhook idempotency and signature verification once gateway is selected**

  * **Priority:** P1
  * **Category:** Payment, API Integrations, Security
  * **Evidence:** `.env.example:5-7` contains PayMongo variables; `PaymentProvider.PAYMONGO` exists in `prisma/schema.prisma:29-32`; no payment route or webhook route exists in `src/app/api` except NextAuth.
  * **Problem:** Payment integration is modeled but not implemented.
  * **Production impact:** Payment status cannot be trusted or reconciled.
  * **Recommended action:** Add provider abstraction, checkout creation, webhook signature validation, event idempotency table, retries, reconciliation job, and failure handling.
  * **Acceptance criteria:** Duplicate webhooks are idempotent; invalid signatures are rejected; payment amount/facility/time are recalculated server-side; tests cover all state transitions.
  * **Dependencies:** Payment provider decision.
  * **Estimated effort:** XL
  * **Release blocker:** No if manual proof workflow ships first; Yes if online payment is required at launch

* [ ] **Implement privacy notice, consent, retention, and data deletion workflow**

  * **Priority:** P1
  * **Category:** Privacy, Compliance
  * **Evidence:** `prisma/schema.prisma:47-63` stores email/name/phone; `prisma/schema.prisma:144-186` stores booking/payment history; no privacy pages/routes/docs are present.
  * **Problem:** Personal data collection lacks repository-visible privacy controls.
  * **Production impact:** Regulatory and trust risk under Philippine Data Privacy Act obligations.
  * **Recommended action:** Add privacy notice, consent capture where needed, retention schedule, account deletion/export process, and access request runbook; get legal review.
  * **Acceptance criteria:** Privacy copy is published; user/admin workflows and support runbooks exist for data export/deletion; retention/deletion jobs are tested.
  * **Dependencies:** Legal/privacy review.
  * **Estimated effort:** L
  * **Release blocker:** No

* [ ] **Add database check constraints for numeric and temporal validity**

  * **Priority:** P1
  * **Category:** Database, Data Integrity
  * **Evidence:** `prisma/schema.prisma:114-126` stores operating-hour minutes; `prisma/schema.prisma:129-141` stores pricing; `prisma/schema.prisma:144-167` stores booking ranges; app schemas validate some fields in `src/features/admin/schemas.ts:5-42`.
  * **Problem:** Invalid values can be inserted if application validation is bypassed.
  * **Production impact:** Corrupt schedules, negative prices, invalid booking ranges, and broken availability calculations.
  * **Recommended action:** Add SQL check constraints for `opensAtMinutes`/`closesAtMinutes`, day of week, positive amounts, valid booking `startAtUtc < endAtUtc`, valid slot counts, and cancellation windows.
  * **Acceptance criteria:** Database rejects invalid rows; migrations include constraints; tests prove invalid inserts fail.
  * **Dependencies:** Data cleanup migration.
  * **Estimated effort:** M
  * **Release blocker:** No

* [ ] **Add database and service tests for booking concurrency**

  * **Priority:** P1
  * **Category:** Testing, Booking Integrity
  * **Evidence:** Existing tests in `src/server/bookings/core.test.ts` cover pure slot helpers. `scripts/concurrency-smoke.ts` now exercises concurrent `createBookingHold` calls and a booking-vs-blocked-schedule race against local Postgres; `.github/workflows/quality-gates.yml` provisions PostgreSQL, migrates, seeds, and runs the smoke test.
  * **Problem:** Standalone booking-vs-booking concurrency now has a repeatable local smoke test. Cross-table booking-vs-blocked-schedule races required an isolation fix and still need CI coverage alongside cart checkout and rescheduling races.
  * **Production impact:** Double-booking bugs may ship undetected.
  * **Recommended action:** Add an isolated CI Postgres service and run the smoke test plus cart checkout, blocked-schedule, and rescheduling race scenarios with synthetic fixtures.
  * **Acceptance criteria:** CI runs database-backed concurrency tests; each race has exactly one valid outcome; failed transactions leave no orphaned order, booking, or hold records.
  * **Dependencies:** Test DB setup and DB constraints.
  * **Estimated effort:** L
  * **Release blocker:** No

* [x] **Add authentication and authorization automated tests**

  * **Completion evidence (2026-08-28):** Registration, email verification, resend throttling, RBAC permission matrices, protected-role behavior, direct server-action denial, data minimization, and migration security controls have automated coverage. End-to-end browser authorization coverage remains tracked separately.

  * **Priority:** P1
  * **Category:** Testing, Authentication, Authorization
  * **Evidence:** No tests exist for `src/auth.ts`, `src/lib/auth/session.ts`, or admin server actions; current test files are only `src/server/bookings/*.test.ts` and `src/features/admin/schemas.test.ts`.
  * **Problem:** Access-control regressions are not caught.
  * **Production impact:** Admin pages/actions or customer data could become accessible accidentally.
  * **Recommended action:** Add tests for customer login, unverified-phone denial, admin route/action denial for customers, and customer booking ownership checks.
  * **Acceptance criteria:** Automated tests prove anonymous/customer/admin access behavior for all protected pages and server actions.
  * **Dependencies:** Test auth/session harness.
  * **Estimated effort:** M
  * **Release blocker:** No

* [ ] **Add safer admin destructive-action UX**

  * **Priority:** P1
  * **Category:** UX, Admin Experience, Reliability
  * **Evidence:** `src/components/admin/delete-block-schedule-button.tsx` is a direct submit button; `src/components/bookings/cancel-booking-button.tsx` has no confirmation dialog.
  * **Problem:** Destructive actions can be clicked accidentally.
  * **Production impact:** Accidental cancellation/block deletion disrupts operations.
  * **Recommended action:** Add confirmation dialogs, disabled states, audit notes/reasons, and undo/restore where appropriate.
  * **Acceptance criteria:** Delete/cancel actions require explicit confirmation and record actor/reason; tests cover cancellation ownership.
  * **Dependencies:** Audit logging.
  * **Estimated effort:** S
  * **Release blocker:** No

* [ ] **Add secure image URL policy and SSRF review**

  * **Priority:** P1
  * **Category:** Security, File Uploads
  * **Evidence:** Admin forms accept arbitrary image URLs (`src/components/admin/facility-form.tsx`, `src/components/admin/facility-create-form.tsx`); schema only checks URL strings in `src/features/admin/schemas.ts:37`; `next.config.ts:4-18` allows selected remote image hosts.
  * **Problem:** External image URLs can break rendering or route through third-party domains; provider allowlist is only partly enforced by Next image config.
  * **Production impact:** Broken pages, privacy leakage to external image hosts, or future SSRF risk if image fetching rules expand.
  * **Recommended action:** Prefer uploaded managed storage URLs; enforce server-side allowlist for remote URLs; document approved image sources.
  * **Acceptance criteria:** Facility image URLs are validated against an allowlist; rejected domains show useful errors; tests cover allowed/disallowed URLs.
  * **Dependencies:** Object storage.
  * **Estimated effort:** S
  * **Release blocker:** No

### P2 — Medium

* [ ] **Add end-to-end tests for core customer and admin journeys**

  * **Priority:** P2
  * **Category:** Testing
  * **Evidence:** `e2e/smoke.spec.ts` and `playwright.config.ts` cover public facility browsing, seeded customer booking checkout, customer proof submission, customer-to-admin payment verification, customer payment rejection and recovery messaging, customer cancellation with slot release, payment-proof remediation after an authorized staff action request, successful same-price/lower-price/higher-price administrative rescheduling with original-slot, adjustment, and additional-payment verification behavior, adding a schedule to the cart, consolidated checkout and proof submission, concurrent conflicting cart checkout with exactly one successful order, expired consolidated-order recovery and slot release, a 390px customer booking-page overflow check, a completed new-customer cash walk-in booking, weak-password registration field preservation, unique Resend test-recipient registration and email verification with invalid-code handling, direct denial checks for sensitive admin routes, a past-booking rescheduling guard, customer booking timeline access, and least-privilege Receptionist, Booking Admin, and Social Media browser journeys. `prisma/seed.ts` provisions role-specific accounts and the expired-order fixture only for local and CI databases. `.github/workflows/quality-gates.yml` provisions a disposable database and runs the suite. The three previously failing availability/auth scenarios, registration verification, and payment-rejection recovery scenarios passed locally on 2026-09-01.
  * **Problem:** Downstream failure/recovery coverage outside expired consolidated orders remains unautomated. Browser coverage remains representative rather than a complete persona matrix.
  * **Production impact:** Login, booking, admin management, or cancellation regressions can ship.
  * **Recommended action:** Extend the Playwright suite with isolated synthetic fixtures for registration/email verification, permission matrix checks, expiry, failed submissions, and downstream recovery. Add desktop/mobile coverage for the most important pages.
  * **Acceptance criteria:** CI runs the complete agreed release journey matrix against a seeded test DB, blocks release on failures, and reports each required persona/workflow explicitly.
  * **Dependencies:** CI and test DB.
  * **Estimated effort:** L
  * **Release blocker:** No

* [ ] **Add accessibility review and fixes**

  * **Priority:** P2
  * **Category:** UX, Accessibility
  * **Evidence:** Custom forms/buttons exist across `src/components`; no accessibility tests or axe tooling are present in `package.json`.
  * **Problem:** Keyboard, screen-reader, focus, and contrast compliance is unverified.
  * **Production impact:** Users and admins with accessibility needs may be blocked.
  * **Recommended action:** Add axe checks, keyboard testing, focus states, confirmation dialog accessibility, and semantic error associations.
  * **Acceptance criteria:** Critical user/admin flows pass automated axe checks and manual keyboard testing.
  * **Dependencies:** E2E framework.
  * **Estimated effort:** M
  * **Release blocker:** No

* [ ] **Improve user-facing error handling and operational error boundaries**

  * **Priority:** P2
  * **Category:** Reliability, UX
  * **Evidence:** Server actions often return raw `error.message` to users in `src/features/bookings/actions.ts:82-87`, `src/features/admin/actions.ts:536-538`; no route-level `error.tsx` files are present.
  * **Problem:** Internal errors may leak implementation details and users get inconsistent recovery guidance.
  * **Production impact:** Poor UX and potential information disclosure.
  * **Recommended action:** Map internal errors to safe error codes/messages; add route error boundaries and retry guidance.
  * **Acceptance criteria:** No raw stack/database/provider errors are shown to users; error boundaries exist for customer/admin areas; tests cover expected error messages.
  * **Dependencies:** Observability.
  * **Estimated effort:** M
  * **Release blocker:** No

* [ ] **Add holiday, exception schedule, and buffer-time support**

  * **Priority:** P2
  * **Category:** Booking Integrity, Product
  * **Evidence:** Operating hours are weekly only in `prisma/schema.prisma:114-126`; blocked schedules exist in `prisma/schema.prisma:188-202`; no holiday/exception table or buffer rules exist.
  * **Problem:** Real facilities need special hours, holidays, and cleanup/setup buffers.
  * **Production impact:** Incorrect availability and operational conflicts on holidays/events.
  * **Recommended action:** Add exception schedules and optional pre/post-booking buffer rules per facility/type.
  * **Acceptance criteria:** Availability considers weekly hours, date exceptions, blocks, bookings, and buffers; tests cover holiday and buffer conflicts.
  * **Dependencies:** Product policy.
  * **Estimated effort:** L
  * **Release blocker:** No

* [ ] **Improve admin reporting accuracy and scalability**

  * **Priority:** P2
  * **Category:** Reporting, Performance
  * **Evidence:** `src/app/admin/reports/page.tsx:16-45` calculates reports in memory and approximates utilization as `(weekly open minutes / 7) * 30`.
  * **Problem:** Reporting is approximate and not optimized for larger datasets.
  * **Production impact:** Misleading revenue/utilization decisions and slow reports.
  * **Recommended action:** Move reporting to parameterized queries/materialized summaries; handle date ranges, facility filters, cancelled/refunded states, and exact open minutes per day.
  * **Acceptance criteria:** Reports match fixture expectations for varied operating hours and statuses; query latency remains bounded on large seed datasets.
  * **Dependencies:** Pagination/filter UX.
  * **Estimated effort:** M
  * **Release blocker:** No

* [ ] **Add staging environment and preview deployment safety**

  * **Priority:** P2
  * **Category:** DevOps
  * **Evidence:** README deployment section `README.md:178-193` describes production-style deployment only; no staging env docs or preview DB strategy exist.
  * **Problem:** Preview/staging deployments may accidentally use production data or lack realistic validation.
  * **Production impact:** Data leaks or untested production releases.
  * **Recommended action:** Define staging Vercel project/env, staging database, seed/reset scripts, and preview deployment restrictions.
  * **Acceptance criteria:** Staging deploy uses non-production secrets/data; release checklist requires staging smoke tests.
  * **Dependencies:** Hosting/database resources.
  * **Estimated effort:** M
  * **Release blocker:** No

* [ ] **Add customer account management**

  * **Priority:** P2
  * **Category:** Privacy, UX
  * **Evidence:** `src/app/bookings/page.tsx` shows booking history only; no profile, phone update, password change, or account deletion routes exist.
  * **Problem:** Customers cannot maintain or delete their account data.
  * **Production impact:** Support burden and privacy compliance gaps.
  * **Recommended action:** Add profile update, password change/reset, phone re-verification, data export, and deletion request flows.
  * **Acceptance criteria:** Customers can update basic details safely; phone changes require OTP; deletion/export requests are logged and handled.
  * **Dependencies:** Privacy workflow and notifications.
  * **Estimated effort:** L
  * **Release blocker:** No

* [ ] **Add mobile/network resilience for booking forms**

  * **Priority:** P2
  * **Category:** UX, Reliability
  * **Evidence:** `src/components/bookings/booking-panel.tsx:24-31` disables submit while pending but no retry/idempotency UI exists; `src/components/bookings/cancel-booking-button.tsx` has minimal pending state.
  * **Problem:** Slow networks and retries are not handled explicitly.
  * **Production impact:** Users may abandon or double-submit bookings.
  * **Recommended action:** Add clearer pending states, retry-safe messages, idempotency display, and post-submit confirmation polling if payment is asynchronous.
  * **Acceptance criteria:** Users receive deterministic status after slow/interrupted booking attempts; duplicate clicks are harmless.
  * **Dependencies:** Idempotency.
  * **Estimated effort:** M
  * **Release blocker:** No

* [ ] **Add dependency update automation**

  * **Priority:** P2
  * **Category:** Security, CI/CD
  * **Evidence:** No Dependabot/Renovate config exists; `npm audit` reports outdated vulnerable packages.
  * **Problem:** Security patches depend on manual checks.
  * **Production impact:** Known vulnerabilities remain longer.
  * **Recommended action:** Add Dependabot or Renovate with grouped updates and CI validation.
  * **Acceptance criteria:** Automated dependency PRs open regularly; security updates are prioritized and tracked.
  * **Dependencies:** CI.
  * **Estimated effort:** S
  * **Release blocker:** No

* [ ] **Document and monitor cost controls**

  * **Priority:** P2
  * **Category:** DevOps, Observability
  * **Evidence:** No cost/quota docs exist; future SMS/storage/payment integrations are noted in README but not operationalized.
  * **Problem:** SMS, image storage, database, and serverless costs are not bounded.
  * **Production impact:** Abuse or growth can create unexpected bills.
  * **Recommended action:** Define provider quotas, alerts, rate limits, storage lifecycle policies, and monthly cost review.
  * **Acceptance criteria:** Cost dashboards/alerts exist for database, Vercel, SMS, email, payment, and storage providers.
  * **Dependencies:** Vendor selection.
  * **Estimated effort:** M
  * **Release blocker:** No

### P3 — Low

* [ ] **Update architecture documentation to match implemented structure**

  * **Priority:** P3
  * **Category:** Documentation, Architecture
  * **Evidence:** `docs/architecture.md:11-33` lists folders like `src/features/payments` and `src/server/payments` that do not exist; current code uses mock payment in booking service.
  * **Problem:** Architecture docs are aspirational and partially stale.
  * **Production impact:** New engineers may misunderstand implemented boundaries.
  * **Recommended action:** Split implemented architecture from target architecture; document current limitations and migration path.
  * **Acceptance criteria:** Docs accurately map current folders, flows, and known deviations.
  * **Dependencies:** Payment/SMS decisions.
  * **Estimated effort:** S
  * **Release blocker:** No

* [ ] **Add operational support documentation**

  * **Priority:** P3
  * **Category:** Documentation, Support
  * **Evidence:** README covers local setup and deployment basics but not admin usage, customer support, incident response, credential rotation, or common operational tasks.
  * **Problem:** Non-engineering operations are undocumented.
  * **Production impact:** Support actions become inconsistent and risky.
  * **Recommended action:** Add admin handbook, support playbooks, incident runbook, credential rotation guide, and troubleshooting docs.
  * **Acceptance criteria:** Staff can resolve common booking, cancellation, payment, account, and facility issues using documented steps.
  * **Dependencies:** Final workflows.
  * **Estimated effort:** M
  * **Release blocker:** No

* [ ] **Add repository governance files**

  * **Priority:** P3
  * **Category:** CI/CD, Documentation
  * **Evidence:** No `.github` directory, `CODEOWNERS`, pull request template, or release checklist exists.
  * **Problem:** Review and release ownership is informal.
  * **Production impact:** Risky changes may bypass proper review.
  * **Recommended action:** Add CODEOWNERS, PR template, release checklist, and branch protection documentation.
  * **Acceptance criteria:** Production-impacting changes require named reviewers and checklist completion.
  * **Dependencies:** Team ownership model.
  * **Estimated effort:** S
  * **Release blocker:** No

* [ ] **Add changelog and release tagging process**

  * **Priority:** P3
  * **Category:** DevOps, Documentation
  * **Evidence:** No `CHANGELOG.md` or release process exists.
  * **Problem:** Production changes are not traceable at a release level.
  * **Production impact:** Harder rollback decisions and support communication.
  * **Recommended action:** Use semantic-ish release notes or manual changelog entries per deployment.
  * **Acceptance criteria:** Each production release has a tag, deployment URL, migration notes, and rollback note.
  * **Dependencies:** CI/CD.
  * **Estimated effort:** S
  * **Release blocker:** No

* [ ] **Polish empty states, copy, and production branding**

  * **Priority:** P3
  * **Category:** UX
  * **Evidence:** Some pages still mention technical concepts such as PostgreSQL in customer-facing copy at `src/app/facilities/page.tsx:11-15`; mock-related success query `mockPaid` is visible in `src/app/bookings/page.tsx:16` and `src/app/bookings/page.tsx:89-91`.
  * **Problem:** Demo/MVP wording remains in customer-facing UI.
  * **Production impact:** Reduced trust and confusing customer experience.
  * **Recommended action:** Replace technical/demo copy with operator/customer language and remove mock-specific wording.
  * **Acceptance criteria:** Customer-facing pages do not mention MVP, mock, or backend implementation details.
  * **Dependencies:** Payment workflow.
  * **Estimated effort:** S
  * **Release blocker:** No

* [ ] **Add browser compatibility and performance budget checks**

  * **Priority:** P3
  * **Category:** Performance, UX
  * **Evidence:** No Lighthouse, bundle analyzer, or browser matrix is configured; build output is manually inspected only.
  * **Problem:** Performance and compatibility are not tracked.
  * **Production impact:** Slow mobile pages or unsupported browser issues can go unnoticed.
  * **Recommended action:** Add Lighthouse CI or scheduled checks for home, facilities, booking, login, and admin pages.
  * **Acceptance criteria:** Performance/accessibility budgets are documented and tracked in CI or scheduled reports.
  * **Dependencies:** Staging/prod monitoring.
  * **Estimated effort:** S
  * **Release blocker:** No

## 4. Security Findings

- **Mock OTP exposure:** See P0 “Replace browser-displayed mock OTP...” Evidence: `src/features/auth/actions.ts:64-88`, `src/components/auth/register-form.tsx:35-36`.
- **Mock payment confirmation:** See P0 “Replace mock payment auto-confirmation...” Evidence: `src/features/bookings/actions.ts:69-77`, `src/server/bookings/service.ts:314-472`.
- **No rate limits:** See P0 “Add rate limiting...” Evidence: auth/actions/server actions have no limiter module or middleware.
- **Known vulnerable dependencies:** See P0 “Upgrade vulnerable production and auth dependencies...” Evidence: `npm audit --json` reports 3 critical and 7 high vulnerabilities.
- **Upload weaknesses:** See P0 “Move facility uploads...” Evidence: `src/features/admin/actions.ts:62-90`.
- **No audit logging:** See P0 “Implement audit logging...” Evidence: schema lacks audit model and mutations do not write audit events.
- **Missing security headers/CSP:** See P1 “Add security headers...” Evidence: `next.config.ts:1-20`.
- **Overbroad admin privilege:** See P1 “Add fine-grained admin roles...” Evidence: `UserRole` only has `ADMIN` and `CUSTOMER`.

## 5. Booking and Data Integrity Findings

Current safeguards:

- **Frontend:** `src/components/bookings/booking-panel.tsx` filters available start times based on server-provided slots and disables submit while pending. This is useful UX but not a security control.
- **Backend/application:** `src/server/bookings/service.ts:168-311` and `src/server/bookings/service.ts:314-472` validate facility enabled state, pricing, duration, operating hours, booking window, past slots, existing bookings, pending holds, and blocked schedules inside Prisma transactions with serializable isolation.
- **Database:** Schema has primary keys, foreign keys, indexes, unique facility slug, unique operating hour per day, unique payment per booking, and unique payment provider reference.

Not reliable enough for production:

- **Double bookings:** Application code attempts to prevent overlap, but `prisma/schema.prisma:144-167` has no PostgreSQL exclusion constraint or slot uniqueness table. Database bypasses or race conditions can still create overlapping bookings.
- **Conflicting schedules:** `BlockedSchedule` has indexes only at `prisma/schema.prisma:188-202`; no database constraint prevents overlapping blocks or blocks conflicting with bookings.
- **Invalid booking states:** Enums exist, but no explicit status-transition guard/audit table ensures legal transitions only.
- **Unauthorized booking changes:** Customer cancellation uses `userId` ownership in `src/server/bookings/service.ts:480-484`; admin mutations are role-gated. However, admin privileges are all-or-nothing and unaudited.
- **Simultaneous requests:** Serializable transactions help, but no integration/concurrency tests prove behavior against the production database/pooler.

## 6. Testing Gaps

### Release-blocking automated tests

- Booking concurrency tests against Postgres for same facility/time.
- Database constraint tests for overlaps and invalid ranges after constraints are added.
- Auth tests for unverified customers, admin-only access, customer-only booking ownership, and login failure paths.
- Payment/proof workflow tests once real confirmation replaces mock mode.
- OTP delivery, expiry, attempt cap, resend cap, and abuse-limit tests.

### Important integration tests

- Facility create/update with images, pricing, operating hours, and cancellation overrides.
- Blocked schedule creation/deletion and booking conflict behavior.
- Walk-in booking user upsert and booking creation.
- Pending booking expiration job.
- Admin reports with cancelled/refunded/pending/confirmed states.

### End-to-end user journeys

- Register, verify phone, login, browse, book, confirm, view booking.
- Customer cancellation inside and outside allowed window.
- Admin login, create facility, block schedule, view calendar, create walk-in, view reports.
- Payment/proof success, failure, expiry, and duplicate submission journeys.

### Security tests

- Rate-limit enforcement on login/register/OTP/booking/admin uploads.
- Authorization checks for every server action and admin page.
- Upload rejection for invalid MIME, invalid extension, oversized files, and polyglot files.
- Dependency audit in CI.
- Security headers/CSP verification.

### Concurrency and load tests

- Simultaneous customer booking attempts for the same slot.
- Simultaneous admin block and customer booking for overlapping time.
- Calendar/report pages with thousands of bookings/customers.
- SMS/email retry storm and provider failure simulation.

### Manual pre-release checks

- Vercel env vars and custom domain HTTPS.
- Supabase backup/PITR and restore drill.
- Admin account creation and credential rotation.
- Payment/SMS provider sandbox-to-production cutover.
- Privacy notice and support runbooks.

## 7. Production Environment Checklist

- [ ] Production `DATABASE_URL` uses a Prisma-compatible Supabase connection mode and least-privilege DB user.
- [ ] `NEXTAUTH_URL` is set to the production domain.
- [ ] `NEXTAUTH_SECRET` is strong, unique, rotated, and not shared in logs/chat.
- [ ] Mock payment is disabled in production.
- [ ] Mock OTP/browser OTP display is disabled in production.
- [ ] Payment provider secrets are production values and scoped.
- [ ] SMS/email provider secrets are production values and scoped.
- [ ] Environment validation rejects placeholders and missing required values.
- [ ] Prisma migrations have been applied with `prisma migrate deploy`.
- [ ] Database constraints for booking integrity are applied.
- [ ] Supabase RLS/public access posture is reviewed and documented.
- [ ] Supabase backups/PITR are enabled.
- [ ] Restore test has been completed.
- [ ] Custom domain and HTTPS are verified.
- [ ] Security headers and CSP are present.
- [ ] Structured logging and error monitoring are configured.
- [ ] Uptime monitoring is configured.
- [ ] Alerts exist for errors, failed bookings, payment failures, DB issues, and notification failures.
- [ ] Rate limiting is enabled for auth, OTP, booking, admin mutations, and uploads.
- [ ] Persistent storage is configured for images/payment proofs.
- [ ] Storage permissions and lifecycle policies are configured.
- [ ] Privacy notice, terms, retention, and deletion workflow are published.
- [ ] Production admin accounts are created securely.
- [ ] Default seeded credentials are absent or disabled.
- [ ] Production smoke tests cover home, login, facility list, booking, bookings page, and admin login.
- [ ] Rollback plan and migration recovery plan are documented.

## 8. Recommended Implementation Phases

### 1. Immediate security and data-integrity remediation

- **Objective:** Remove demo-only trust assumptions and protect core booking/payment/auth invariants.
- **Included TODOs:** P0 payment replacement, OTP replacement, rate limiting, DB overlap constraints, booking idempotency, secure uploads, dependency upgrades, env validation, seed credential removal.
- **Entry criteria:** Current MVP branch is stable and backed up.
- **Exit criteria:** No mock auth/payment in production, no high/critical production audit findings, database rejects overlapping bookings, and core mutation paths are rate limited.

### 2. Core production reliability

- **Objective:** Make production operations recoverable and explainable.
- **Included TODOs:** Audit logging, pending booking expiration, Supabase backup/RLS validation, observability, health checks, backup/restore runbooks, rollback strategy.
- **Entry criteria:** Immediate P0 security/data controls complete.
- **Exit criteria:** Booking/payment/admin changes are auditable; expired holds are cleaned; monitoring and restore procedure are verified.

### 3. Testing and release automation

- **Objective:** Prevent regressions before deployment.
- **Included TODOs:** CI/CD gates, database concurrency tests, auth/authorization tests, E2E tests, dependency update automation.
- **Entry criteria:** Test database and CI secrets available.
- **Exit criteria:** Release branch cannot deploy unless lint, typecheck, tests, audit, build, and migration validation pass.

### 4. Monitoring and operational readiness

- **Objective:** Prepare support and incident response for real customer traffic.
- **Included TODOs:** Notification system, operational support docs, privacy workflows, cost monitoring, uptime alerts.
- **Entry criteria:** Core release automation and audit logging available.
- **Exit criteria:** Staff can detect, triage, notify, and recover from common incidents.

### 5. Controlled pilot

- **Objective:** Run with limited real users under close monitoring.
- **Included TODOs:** Admin role scoping, paginated admin queries, destructive-action UX, user-facing error handling, staging smoke tests.
- **Entry criteria:** P0 complete; P1 operational controls substantially complete.
- **Exit criteria:** Pilot issues are logged, fixed, and measured; no unresolved critical booking/payment/auth defects.

### 6. General production launch

- **Objective:** Expand safely beyond pilot traffic.
- **Included TODOs:** Accessibility, reporting scalability, holiday/exception schedules, customer account management, performance budgets.
- **Entry criteria:** Controlled pilot success and sign-off.
- **Exit criteria:** Production SLAs, support coverage, privacy operations, and release process are active.

## 9. Unknowns Requiring Validation

- **Hosting settings not stored in code:** Vercel project settings, deployment protection, team access, preview behavior, function limits, custom-domain configuration, and environment variables.
- **Supabase dashboard configuration:** Backups/PITR, RLS, public API exposure, connection pooler mode, database user privileges, SSL enforcement, and storage buckets.
- **Production secrets:** Current values, rotation history, access control, and whether secrets were shared outside secure secret stores.
- **Payment provider status:** No production provider is implemented; PayMongo variables exist but the gateway is deferred.
- **SMS provider status:** No production provider is implemented; OTP is mocked.
- **Backup policies:** Not visible in repository.
- **Restore testing:** Not visible in repository.
- **Domain ownership and DNS controls:** Partially configured externally; current authoritative settings are not in repository.
- **Privacy and legal documents:** Not present in repository.
- **Operational ownership:** No CODEOWNERS/runbook/support escalation ownership is present.
- **Support processes:** Refunds, cancellations, disputed bookings, and account deletion workflows are not documented.
- **Supabase Storage or Cloudinary setup:** Not present in repository.

## 10. Suggested Next 10 Tasks

1. Validate Supabase Storage bucket privacy, retention, quotas, and hosted upload behavior in staging.
2. Replace or formally gate mock payment confirmation and browser-visible OTP behavior before real customer use.
3. Validate Supabase Data API/RLS exposure, least-privilege credentials, connection pooling, backups/PITR, and a staging restore drill.
4. Add database-backed concurrency tests for standalone booking, consolidated checkout, blocked schedules, and rescheduling races.
5. Publish privacy, retention, account-deletion/export, incident-response, and customer-support runbooks.
6. Add automated end-to-end release smoke tests for registration, direct booking, consolidated checkout, proof verification, walk-ins, RBAC denial, and rescheduling.
7. Configure Vercel health/readiness monitoring and alerting using `HEALTHCHECK_SECRET`.
8. Configure GitHub branch protection to require the `Quality gates` workflow before merge.
9. Run a verified Supabase restore drill and record recovery time and recovery point results.
10. Conduct a controlled staging pilot with synthetic data and review logs, rate-limit events, storage usage, and failed jobs.
