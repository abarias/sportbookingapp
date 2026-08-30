export type RateLimitPolicy = {
  limit: number;
  windowSeconds: number;
};

function positiveInteger(key: string, fallback: number) {
  const value = Number.parseInt(process.env[key] ?? "", 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export const rateLimitPolicies = {
  login: (): RateLimitPolicy => ({
    limit: positiveInteger("RATE_LIMIT_LOGIN_MAX", 10),
    windowSeconds: positiveInteger("RATE_LIMIT_LOGIN_WINDOW_SECONDS", 15 * 60)
  }),
  booking: (): RateLimitPolicy => ({
    limit: positiveInteger("RATE_LIMIT_BOOKING_MAX", 10),
    windowSeconds: positiveInteger("RATE_LIMIT_BOOKING_WINDOW_SECONDS", 5 * 60)
  }),
  paymentProof: (): RateLimitPolicy => ({
    limit: positiveInteger("RATE_LIMIT_PAYMENT_PROOF_MAX", 6),
    windowSeconds: positiveInteger("RATE_LIMIT_PAYMENT_PROOF_WINDOW_SECONDS", 15 * 60)
  }),
  adminMutation: (): RateLimitPolicy => ({
    limit: positiveInteger("RATE_LIMIT_ADMIN_MUTATION_MAX", 60),
    windowSeconds: positiveInteger("RATE_LIMIT_ADMIN_MUTATION_WINDOW_SECONDS", 10 * 60)
  })
} as const;
