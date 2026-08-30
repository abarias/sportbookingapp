import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "./logger";

afterEach(() => vi.restoreAllMocks());

describe("structured logger", () => {
  it("redacts sensitive metadata fields", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logger.error("payment.failed", { paymentId: "payment-1", authorization: "Bearer secret", customerEmail: "person@example.com" });

    const record = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(record).toMatchObject({ event: "payment.failed", paymentId: "payment-1", authorization: "[REDACTED]", customerEmail: "[REDACTED]" });
  });
});
