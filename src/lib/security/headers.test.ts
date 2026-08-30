import { describe, expect, it } from "vitest";

import { getSecurityHeaders } from "./headers";

describe("security response headers", () => {
  it("sets browser hardening headers and a report-only CSP", () => {
    const headers = new Map(getSecurityHeaders(false).map((header) => [header.key, header.value]));

    expect(headers.get("Content-Security-Policy-Report-Only")).toContain("frame-ancestors 'none'");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.has("Strict-Transport-Security")).toBe(false);
  });

  it("enables HSTS only for production deployments", () => {
    const headers = new Map(getSecurityHeaders(true).map((header) => [header.key, header.value]));
    expect(headers.get("Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains");
  });
});
