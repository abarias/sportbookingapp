# Customer FAQ

The public `/faq` route reads published content from PostgreSQL through Prisma. The shared customer navigation includes **FAQs** on desktop and in the mobile menu. Anonymous visitors can read the page too.

## Source and content review

`prisma/data/faq.json` contains the reviewed transcription of the repository's `FAQs.pdf`, beginning at **FAQs page text content**. It contains **9 topics and 36 question/answer pairs**. The JSON records the PDF SHA-256, source page numbers and original question numbers for traceability. The PDF is a source document, not a public download or runtime dependency.

All five pages were visually reviewed, and every question, paragraph and bullet was compared with extracted PDF text after whitespace normalization. Paragraph continuations on pages 2–3 (rescheduling) and 4–5 (property damage) were joined correctly. Paragraph breaks, cancellation bullets, inline emphasis and contact links are retained.

To repeat the read-only source comparison, run `python3 scripts/verify-faq-source.py` with `pypdf` installed. A changed PDF hash fails the check and requires a new manual review; it is not silently imported.

Conservative extraction decisions:

- Exclude the Payment Details preamble, the repeated topic index, decorative highlighting and internal comments addressed to `@AB`/`@CLL`.
- Use actual section titles: **PAYMENT & RATES** and **CANCELLATIONS & CHANGES**, rather than the shortened/inconsistent titles in the index.
- Refunds skips question 6; Facility Use repeats question 4. Preserve all questions in physical order, retain original numbers in source metadata, and display questions without those inconsistent numeric prefixes. No missing question was invented.
- Preserve the wording `60minutes`, `more than seven (7) from your game date`, and `same number hours of play`. These are source wording issues, not extraction failures; no missing words were supplied.
- Preserve the published-policy text even where it differs from current application configuration (operating hours, advance booking, onsite payment methods, cancellation/refund rules). This feature does not change the application's business rules. The source's refund section carries an internal review note; policy-owner review can happen separately through a future content update.
- The source contains a bare booking-domain name and email addresses; links use HTTPS/mailto without changing their visible text. The SMS contact uses a telephone link.

## Database and deployment

Apply the additive migration and import content in the target environment before exposing the route:

```sh
npm run db:generate
npm run db:validate
npm run db:deploy
npm run db:seed:faq
```

Use the target's `DATABASE_URL` and `DIRECT_URL` as usual. The FAQ-only seed is suitable for deployment: it creates no accounts, bookings, settings or fixtures. The general development seed also calls the FAQ import, but its existing production restrictions still apply.

`20260903090000_add_faq` adds:

- `FaqTopic`: CUID primary key, unique stable `slug`, title, nullable description, nonnegative `displayOrder`, `isPublished` (default false), UTC `createdAt`/`updatedAt`.
- `FaqItem`: CUID primary key, topic foreign key, stable slug unique within its topic, question, versioned JSONB answer, nonnegative order, publication flag and timestamps. Deleting a topic cascades to its items; future admin deletion must explicitly confirm this.
- Publication/order indexes on both tables, nonblank title/question and slug constraints, and a JSON envelope check. Prisma sets `updatedAt` on writes; any future raw-SQL writer must set it explicitly.

The import validates the entire source before writing and uses a transaction with natural-key upserts. A rerun inserts missing records without changing existing content, publication flags, order, IDs or timestamps. It does not delete records. Changing a source slug creates a new record; keep slugs stable. Editing the source JSON is not a mechanism for overwriting later CMS edits.

Hard-deleted source records are considered missing and will be recreated on the next import. Use unpublishing to retire content while this source import remains part of deployment, or retire the one-time import once the admin CMS owns the content lifecycle.

## Publication, queries and security

Only published topics and published items within those topics are selected by `src/server/faq/repository.ts`. Prisma fetches topics and all their published items in a bounded number of queries, rather than one query per topic. Ties in `displayOrder` sort by slug. Unpublished records are excluded before rendering, including the HTML/RSC payload. A published topic with no published items gets a neutral empty message.

The route uses the repository's `force-dynamic` convention. There is no cross-request FAQ cache; changes appear on the next server request or refresh. Future admin actions can use `revalidatePath('/faq')` after successful writes to refresh already visited routes predictably.

RLS is enabled on both tables. SELECT policies require publication; the item policy also checks its parent. All PUBLIC privileges are revoked. If Supabase `anon`/`authenticated` roles exist, the migration revokes their table privileges and grants SELECT only. No public write policy or speculative admin policy is created. On plain PostgreSQL, application visitors use the server query; database credentials never reach the browser. Trusted Prisma server access may bypass RLS, so the repository's publication filters remain mandatory.

If Supabase browser roles are provisioned only after the migration, the operator must explicitly grant those roles SELECT on these two tables; the RLS policies already apply. Never grant them write privileges. There are no FAQ write routes or Server Actions.

## Answer format for a future editor

`src/features/faq/content.ts` defines the strict, versioned Zod contract shared by import, server reads and future writes:

```json
{
  "version": 1,
  "blocks": [
    { "type": "paragraph", "content": [{ "text": "A paragraph." }] },
    { "type": "list", "ordered": false, "items": [
      [{ "text": "A bullet with " }, { "text": "emphasis", "strong": true }],
      [{ "text": "Contact us", "href": "mailto:example@example.com" }]
    ] }
  ]
}
```

Use one block per paragraph or list, `ordered: true` for numbered steps, and inline spans for emphasis/links. Links permit HTTP(S), mailto and tel only. Unknown block types, invalid links, empty answers and duplicate import keys fail validation. React renders escaped text and semantic elements; no HTML injection or rich-text dependency is involved.

The accordion follows the application's native `details`/`summary` convention. Topics initially omit `open`, multiple topics can open, Enter/Space toggle controls, native disclosure semantics expose state, and `aria-controls`/`aria-labelledby` associate panels. It also works without JavaScript. Focus is visible and icon animation is limited to `motion-safe`. The route intentionally waits for its database query instead of using a `loading.tsx` streaming boundary: Next's client-side replacement of that fallback otherwise prevents no-JavaScript visitors from seeing the FAQ content.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run db:validate
npm run build
# A migrated, dedicated local database is required; never use live customer data.
FAQ_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/sportbooking_faq_test npm run test:faq:db
# Point DATABASE_URL/DIRECT_URL at that database for the browser server too.
npx playwright test e2e/faq.spec.ts
```

Database tests verify published/unpublished parents and children, actual ordering, empty data, rerun preservation, constraints, unfiltered reads under RLS, and denied writes under a temporary browser-equivalent role. That role and all security fixtures are rolled back. Tests require a database owner with local CREATE ROLE rights, as in the existing CI PostgreSQL service. CI runs the database test and the FAQ browser scenarios.

Playwright covers anonymous and signed-in navigation, all topic/question order, initial collapse, pointer and keyboard toggles, simultaneous expansion, source lists/contact links, long cross-page answers, overflow at mobile/tablet/desktop sizes, and operation without JavaScript. Component tests cover empty/error states and safe content rendering.

## Future admin FAQ editor

Add a dedicated FAQ permission to the existing RBAC catalogue and enforce it with `requirePermission` in server actions. Use the shared answer schema for validation; transact reorder/publish/edit/delete operations and append the existing `AuditLog` with actor and before/after data. Provide draft preview only behind that permission. Keep public queries unchanged, retain stable slugs, and revalidate `/faq` after writes. There is no need to add a browser-role admin RLS policy: administrative writes can use the existing trusted server/service layer.
