import { describe, expect, it } from "vitest";

import { getSiteTitle } from "./site";

describe("getSiteTitle", () => {
  it("keeps production branding neutral", () => {
    expect(getSiteTitle({ APP_ENV: "prod" })).toBe("MMG Stellar");
    expect(getSiteTitle({ VERCEL_ENV: "production" })).toBe("MMG Stellar");
  });

  it("labels configured non-production environments", () => {
    expect(getSiteTitle({ APP_ENV: "dev" })).toBe("MMG Stellar - DEV");
    expect(getSiteTitle({ APP_ENV: "qa" })).toBe("MMG Stellar - QA");
    expect(getSiteTitle({ APP_ENV: "stage" })).toBe("MMG Stellar - STAGE");
  });

  it("defaults local development to LOCAL", () => {
    expect(getSiteTitle({ NODE_ENV: "development" })).toBe("MMG Stellar - LOCAL");
  });
});
