import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaClient, type Prisma } from "@prisma/client";
import { seedFaqs } from "../prisma/faq-content";
import { selectPublishedFaqs } from "../src/server/faq/repository";

const databaseUrl = process.env.FAQ_TEST_DATABASE_URL ?? (process.env.CI ? process.env.DATABASE_URL : undefined);
if (!databaseUrl) throw new Error("Set FAQ_TEST_DATABASE_URL to a dedicated local database ending in _faq_test.");
const target = new URL(databaseUrl);
if (!["localhost", "127.0.0.1", "::1"].includes(target.hostname) || !(target.pathname.endsWith("_faq_test") || (process.env.CI && target.pathname === "/ci_placeholder"))) {
  throw new Error("FAQ integration tests require a dedicated local *_faq_test database (or CI ci_placeholder).");
}
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const answer = { version: 1, blocks: [{ type: "paragraph", content: [{ text: "Integration answer" }] }] };
const rollback = new Error("Rollback FAQ integration fixtures");

async function denied(tx: Prisma.TransactionClient, sql: string, expectedCode = "42501") {
  await tx.$executeRawUnsafe("SAVEPOINT denied_write");
  let failed = false;
  try { await tx.$executeRawUnsafe(sql); } catch (error) {
    failed = true;
    assert.equal((error as { meta?: { code?: string } }).meta?.code, expectedCode);
  }
  await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT denied_write");
  assert(failed, `Public write unexpectedly permitted: ${sql}`);
}

async function main() {
  const initial = await seedFaqs(prisma);
  assert.deepEqual(initial, { topics: 9, items: 36 });
  const original = await prisma.faqTopic.findUniqueOrThrow({ where: { slug: "operating-hours" } });
  const before = await prisma.faqItem.findMany({ select: { id: true, updatedAt: true }, orderBy: { id: "asc" } });
  try {
    await prisma.faqTopic.update({ where: { id: original.id }, data: { title: "CMS edit", isPublished: false, displayOrder: 999 } });
    await seedFaqs(prisma);
    const preserved = await prisma.faqTopic.findUniqueOrThrow({ where: { id: original.id } });
    assert.equal(preserved.title, "CMS edit");
    assert.equal(preserved.isPublished, false);
    assert.equal(preserved.displayOrder, 999);
    assert.deepEqual(await prisma.faqItem.findMany({ select: { id: true, updatedAt: true }, orderBy: { id: "asc" } }), before);
  } finally {
    await prisma.faqTopic.update({ where: { id: original.id }, data: { title: original.title, isPublished: original.isPublished, displayOrder: original.displayOrder, updatedAt: original.updatedAt } });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.faqTopic.updateMany({ data: { isPublished: false } });
      assert.deepEqual(await selectPublishedFaqs(tx), []);
      const second = await tx.faqTopic.create({ data: { slug: "test-second", title: "Second", isPublished: true, displayOrder: 2 } });
      const first = await tx.faqTopic.create({ data: { slug: "test-first", title: "First", isPublished: true, displayOrder: 1 } });
      const hidden = await tx.faqTopic.create({ data: { slug: "test-hidden", title: "Hidden", isPublished: false } });
      for (const [topicId, slug, isPublished, displayOrder] of [
        [first.id, "second", true, 2], [first.id, "first", true, 1],
        [first.id, "draft", false, 0], [hidden.id, "hidden-parent", true, 0],
        [second.id, "only", true, 0]
      ] as const) {
        await tx.faqItem.create({ data: { topicId, slug, question: slug, answer, isPublished, displayOrder } });
      }
      const visible = await selectPublishedFaqs(tx);
      assert.deepEqual(visible.map((topic) => topic.title), ["First", "Second"]);
      assert.deepEqual(visible[0].items.map((item) => item.question), ["first", "second"]);
      assert(!JSON.stringify(visible).includes("draft"));
      assert(!JSON.stringify(visible).includes("hidden-parent"));

      // A temporary browser-equivalent role is removed by the transaction rollback.
      await tx.$executeRawUnsafe("CREATE ROLE faq_policy_test NOLOGIN NOSUPERUSER NOBYPASSRLS");
      await tx.$executeRawUnsafe("GRANT USAGE ON SCHEMA public TO faq_policy_test");
      await tx.$executeRawUnsafe('GRANT SELECT ON "FaqTopic", "FaqItem" TO faq_policy_test');
      await tx.$executeRawUnsafe("SET LOCAL ROLE faq_policy_test");
      assert.deepEqual(await selectPublishedFaqs(tx), visible);
      assert.deepEqual(await tx.$queryRawUnsafe('SELECT title FROM "FaqTopic" ORDER BY "displayOrder"'), [{ title: "First" }, { title: "Second" }]);
      assert.deepEqual(await tx.$queryRawUnsafe('SELECT question FROM "FaqItem" ORDER BY question'), [{ question: "first" }, { question: "only" }, { question: "second" }]);
      await denied(tx, `INSERT INTO "FaqTopic" (id, slug, title, "updatedAt") VALUES ('test-write', 'test-write', 'Denied', NOW())`);
      await denied(tx, `UPDATE "FaqTopic" SET title = 'Denied' WHERE slug = 'test-first'`);
      await denied(tx, `DELETE FROM "FaqItem" WHERE slug = 'first'`);
      await tx.$executeRawUnsafe("RESET ROLE");

      // Even accidentally granted DML privileges must not bypass read-only RLS.
      await tx.$executeRawUnsafe('GRANT INSERT, UPDATE, DELETE ON "FaqTopic", "FaqItem" TO faq_policy_test');
      await tx.$executeRawUnsafe("SET LOCAL ROLE faq_policy_test");
      assert.equal(await tx.$executeRawUnsafe('UPDATE "FaqTopic" SET title = \'Denied\''), 0);
      assert.equal(await tx.$executeRawUnsafe('DELETE FROM "FaqItem"'), 0);
      await denied(tx, `INSERT INTO "FaqTopic" (id, slug, title, "updatedAt") VALUES ('test-write', 'test-write', 'Denied', NOW())`);
      await denied(tx, `INSERT INTO "FaqItem" (id, "topicId", slug, question, answer, "updatedAt") SELECT 'test-write', id, 'test-write', 'Denied', '{"version":1,"blocks":[{}]}'::jsonb, NOW() FROM "FaqTopic" LIMIT 1`);
      await tx.$executeRawUnsafe("RESET ROLE");
      for (const role of ["anon", "authenticated"]) {
        const roles = await tx.$queryRaw<Array<{ rolname: string }>>`SELECT rolname FROM pg_roles WHERE rolname = ${role}`;
        if (!roles.length) continue;
        const grants = await tx.$queryRaw<Array<{ allowed: boolean; writes: boolean }>>`SELECT has_table_privilege(${role}, '"FaqTopic"', 'SELECT') AND has_table_privilege(${role}, '"FaqItem"', 'SELECT') AS allowed, has_table_privilege(${role}, '"FaqTopic"', 'INSERT,UPDATE,DELETE,TRUNCATE') OR has_table_privilege(${role}, '"FaqItem"', 'INSERT,UPDATE,DELETE,TRUNCATE') AS writes`;
        assert.equal(grants[0].allowed, true);
        assert.equal(grants[0].writes, false);
      }
      await denied(tx, `UPDATE "FaqTopic" SET "displayOrder" = -1 WHERE slug = 'test-first'`, "23514");
      await denied(tx, `UPDATE "FaqItem" SET answer = '{}'::jsonb WHERE slug = 'first'`, "23514");
      throw rollback;
    }, { timeout: 30_000 });
  } catch (error) { if (error !== rollback) throw error; }
  console.log("FAQ database checks passed: import repeatability/CMS preservation, empty data, publishing, ordering, RLS, denied writes, and constraints. Test fixtures rolled back.");
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
