import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(process.cwd(), "prisma/migrations/20260828100000_add_rate_limit_buckets/migration.sql"),
  "utf8"
);

describe("rate-limit migration", () => {
  it("creates atomic fixed-window buckets with bounded cleanup indexes", () => {
    expect(migration).toContain('CREATE TABLE "RateLimitBucket"');
    expect(migration).toContain('RateLimitBucket_action_subjectHash_windowStart_key');
    expect(migration).toContain('RateLimitBucket_expiresAt_idx');
    expect(migration).toContain('CHECK ("attempts" > 0)');
  });

  it("prevents direct browser-role access", () => {
    expect(migration).toContain('ALTER TABLE "RateLimitBucket" ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON TABLE "RateLimitBucket" FROM anon');
    expect(migration).toContain('REVOKE ALL ON TABLE "RateLimitBucket" FROM authenticated');
  });
});
