import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn()
}));

vi.mock("resend", () => ({
  Resend: vi.fn(function Resend() {
    return {
    emails: {
      send: mocks.send
    }
    };
  })
}));

import { sendVerificationEmail } from "./email";

const params = {
  to: "juan@example.com",
  fullName: "Juan Dela Cruz",
  code: "123456",
  expiresInMinutes: 15
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("NODE_ENV", "test");
});

describe("sendVerificationEmail", () => {
  it("falls back to console delivery outside production when Resend is not configured", async () => {
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(sendVerificationEmail(params)).resolves.toEqual({
      delivered: false,
      provider: "console"
    });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("code=123456"));
    expect(mocks.send).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("throws in production when email delivery is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(sendVerificationEmail(params)).rejects.toThrow("Email delivery is not configured");
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("sends via Resend when configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "Sport Booking PH <bookings@example.com>");
    mocks.send.mockResolvedValue({
      data: { id: "email_123" },
      error: null
    });

    await expect(sendVerificationEmail(params)).resolves.toEqual({
      delivered: true,
      provider: "resend",
      providerMessageId: "email_123"
    });
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Sport Booking PH <bookings@example.com>",
        html: expect.stringContaining("123456"),
        subject: "Verify your Sport Booking PH account",
        text: expect.stringContaining("123456"),
        to: "juan@example.com"
      })
    );
  });

  it("surfaces Resend delivery failures", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "Sport Booking PH <bookings@example.com>");
    mocks.send.mockResolvedValue({
      data: null,
      error: { message: "domain not verified" }
    });

    await expect(sendVerificationEmail(params)).rejects.toThrow("domain not verified");
  });
});
