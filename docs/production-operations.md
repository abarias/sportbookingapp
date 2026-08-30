# Production Operations Runbook

## Release Gate

Pull requests and promotion branches run `.github/workflows/quality-gates.yml`. Configure GitHub branch protection so the `verify` job is required before merge to `dev`, `qa`, `staging`, and `main`.

Before promoting a release:

1. Confirm the workflow passes from a locked `npm ci` install.
2. Review every pending Prisma migration and take a current database backup.
3. Run `npm run db:deploy` against the target database before deploying application code that requires the new schema.
4. Deploy to staging and smoke-test registration, direct booking, cart checkout, proof upload, payment verification, walk-in booking, and rescheduling.
5. Promote the same reviewed commit to production.

Run `npm run test:concurrency` against a local seeded database before promoting booking, cart, or rescheduling changes. The script is intentionally restricted to localhost and creates then removes only `uat-concurrency-*` test bookings.

Run `npm run test:e2e` with a seeded local database and the app running locally. The Playwright smoke suite covers public facility browsing, customer booking checkout, admin workspace access, and customer denial of admin access. Use synthetic seeded accounts only.

## Health and Monitoring

- `GET /api/health` is a liveness check and does not access the database.
- `GET /api/readiness` checks database connectivity with a three-second application timeout and requires `Authorization: Bearer <HEALTHCHECK_SECRET>` in hosted environments.
- Both responses use `Cache-Control: no-store` and expose no credentials or database error details.
- Configure an external uptime monitor for the home page, `/api/health`, and `/api/readiness` at five-minute intervals or better. Store `HEALTHCHECK_SECRET` in the monitor's protected header configuration.
- Alert on two consecutive readiness failures, elevated 5xx responses, failed payment verification, failed checkout, and cron failures.
- Application logs are JSON records. Correlate health/readiness failures using `requestId` and configure the hosting log drain to retain production logs according to the approved retention policy.

## Supabase Production Checklist

- Confirm the Data API is disabled if the application uses Prisma exclusively. If it is enabled intentionally, expose only reviewed schemas and validate every RLS policy.
- Confirm `anon` and `authenticated` cannot access Prisma-owned tables directly. Security-sensitive migrations explicitly revoke browser-role access where those roles exist.
- Use separate Supabase projects and credentials for development, QA, staging, and production.
- Store `DATABASE_URL`, `DIRECT_URL`, and `SUPABASE_SERVICE_ROLE_KEY` only in server-side Vercel environment variables.
- Use the pooled runtime URL recommended for serverless traffic and a direct/session-compatible URL for migrations.
- Verify private `payment-proofs` and `facility-images` buckets, signed read access, file-size limits, lifecycle rules, and storage-cost alerts.
- Run `npm run storage:check` with the target environment's server-only Supabase variables. This read-only check confirms the configured payment-proof bucket is private and the facility-image bucket is public; it does not validate policies, quotas, lifecycle rules, or upload content.
- Enable the available backup/PITR option and document its retention period.

## Backup and Restore Drill

1. Record the production recovery-point objective and recovery-time objective with the facility owner.
2. Before each schema release, confirm the latest managed backup completed successfully.
3. Restore a recent backup into an isolated staging project at least quarterly.
4. Run `npm run db:deploy` against the restored database and execute the release smoke tests.
5. Reconcile representative booking, payment, order, rescheduling, audit, and facility-image records.
6. Record the drill date, backup timestamp, recovery duration, tester, and discrepancies outside the source repository.

## Rollback and Migration Recovery

- Prefer additive, backward-compatible migrations and deploy schema before code.
- If application behavior fails after deployment, use Vercel's deployment rollback to restore the prior application build.
- Do not attempt destructive migration rollback against production. Keep additive columns/tables and prepare a reviewed forward-fix migration.
- For a data-corrupting migration, stop writes, preserve logs, take a fresh snapshot, and restore only after incident-owner approval.
- Never use `prisma migrate reset` against shared or production databases.

## Incident Response

1. Identify impact: authentication, availability, checkout, payment verification, storage, or administration.
2. Stop promotion and disable only the affected workflow when a safe feature switch exists; do not disable rate limiting in production.
3. Preserve Vercel logs, Supabase database logs, audit records, deployment IDs, and request IDs.
4. For booking-integrity incidents, stop booking writes before manually changing inventory records.
5. For credential exposure, rotate the affected Vercel/Supabase/Resend secrets and invalidate sessions where applicable.
6. Notify operational owners using customer-appropriate language without exposing internal notes or personal data.
7. Document timeline, root cause, customer impact, recovery, and preventive action.

## Required External Configuration

Repository code cannot verify branch protection, Vercel alerts, Supabase backups, restore success, Data API settings, DNS ownership, or staff escalation contacts. Record evidence for these controls in the organization's private operations system, not in public source control.
