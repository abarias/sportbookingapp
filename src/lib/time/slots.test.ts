import { describe, expect, it } from "vitest";

import { buildUtcDateFromLocalMinutes } from "@/lib/time/slots";

describe("buildUtcDateFromLocalMinutes", () => {
  it("converts midnight closing time to the next UTC date", () => {
    expect(buildUtcDateFromLocalMinutes("2026-08-25", 1440, "Asia/Manila").toISOString()).toBe("2026-08-25T16:00:00.000Z");
  });

  it("preserves ordinary same-day local times", () => {
    expect(buildUtcDateFromLocalMinutes("2026-08-25", 360, "Asia/Manila").toISOString()).toBe("2026-08-24T22:00:00.000Z");
  });
});
