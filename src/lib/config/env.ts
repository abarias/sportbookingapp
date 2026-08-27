const POSITIVE_INTEGER_KEYS = [
  "AUTH_REGISTRATION_WINDOW_MINUTES",
  "AUTH_MAX_REGISTRATION_ATTEMPTS",
  "AUTH_EMAIL_VERIFICATION_EXPIRY_MINUTES",
  "AUTH_MAX_EMAIL_VERIFICATION_ATTEMPTS",
  "AUTH_RESEND_VERIFICATION_WINDOW_MINUTES",
  "AUTH_MAX_RESEND_VERIFICATION_ATTEMPTS",
  "AUTH_VERIFICATION_TOKEN_RETENTION_DAYS",
  "AUTH_REGISTRATION_ATTEMPT_RETENTION_DAYS",
    "PAYMENT_HOLD_MINUTES",
    "CART_EXPIRY_DAYS",
  "RESCHEDULE_CUTOFF_HOURS",
  "RESCHEDULE_PAYMENT_HOLD_MINUTES"
] as const;

const PLACEHOLDER_PATTERNS = [/replace/i, /change[-_ ]?me/i, /dev-only/i, /placeholder/i, /test_replace/i];

export type PaymentMode = "mock" | "manual" | "gateway";

export type EnvironmentValidationResult = {
  isStrictProduction: boolean;
  errors: string[];
};

type EnvSource = Record<string, string | undefined>;

export function isStrictProductionEnvironment(env: EnvSource = process.env) {
  return env.AUTH_STRICT_ENV_VALIDATION === "true" || env.VERCEL_ENV === "production";
}

function isPlaceholder(value: string | undefined) {
  return !value || PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

function isLocalUrl(value: string) {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value);
}

function isPositiveInteger(value: string | undefined) {
  if (!value) {
    return true;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 && String(parsed) === value;
}

function isPostgresUrl(value: string | undefined) {
  return Boolean(value && /^postgres(ql)?:\/\//.test(value));
}

function isHttpsUrl(value: string | undefined) {
  if (!value) {
    return false;
  }

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function getPaymentMode(env: EnvSource = process.env): PaymentMode {
  const rawMode = env.PAYMENT_MODE;

  if (rawMode === "manual" || rawMode === "gateway" || rawMode === "mock") {
    return rawMode;
  }

  return isStrictProductionEnvironment(env) ? "manual" : "mock";
}

export function isProductionMockPaymentAllowed(env: EnvSource = process.env) {
  return env.ALLOW_PRODUCTION_MOCK_PAYMENTS === "true";
}

export function validateServerEnvironment(env: EnvSource = process.env): EnvironmentValidationResult {
  const errors: string[] = [];
  const isStrictProduction = isStrictProductionEnvironment(env);

  for (const key of POSITIVE_INTEGER_KEYS) {
    if (!isPositiveInteger(env[key])) {
      errors.push(`${key} must be a positive integer when set.`);
    }
  }

  if (!isStrictProduction) {
    return { isStrictProduction, errors };
  }

  if (!isPostgresUrl(env.DATABASE_URL)) {
    errors.push("DATABASE_URL must be a PostgreSQL connection string.");
  } else if (env.DATABASE_URL && isLocalUrl(env.DATABASE_URL)) {
    errors.push("DATABASE_URL must not point to localhost in production.");
  }

  if (env.DIRECT_URL && isLocalUrl(env.DIRECT_URL)) {
    errors.push("DIRECT_URL must not point to localhost in production.");
  }

  if (!isHttpsUrl(env.NEXTAUTH_URL)) {
    errors.push("NEXTAUTH_URL must be an HTTPS URL in production.");
  }

  if (!env.NEXTAUTH_URL || isLocalUrl(env.NEXTAUTH_URL)) {
    errors.push("NEXTAUTH_URL must not point to localhost in production.");
  }

  if (isPlaceholder(env.NEXTAUTH_SECRET) || (env.NEXTAUTH_SECRET?.length ?? 0) < 32) {
    errors.push("NEXTAUTH_SECRET must be a strong non-placeholder value with at least 32 characters.");
  }

  if (!env.RESEND_API_KEY?.startsWith("re_")) {
    errors.push("RESEND_API_KEY must be configured for production email verification.");
  }

  if (!env.EMAIL_FROM || !env.EMAIL_FROM.includes("@")) {
    errors.push("EMAIL_FROM must be configured with a verified sender address.");
  }

  if (isPlaceholder(env.CRON_SECRET) || (env.CRON_SECRET?.length ?? 0) < 32) {
    errors.push("CRON_SECRET must be a strong non-placeholder value with at least 32 characters.");
  }

  const paymentMode = env.PAYMENT_MODE;

  if (paymentMode !== "manual" && paymentMode !== "gateway" && paymentMode !== "mock") {
    errors.push("PAYMENT_MODE must be one of: manual, gateway, mock.");
  }

  if (paymentMode === "mock" && !isProductionMockPaymentAllowed(env)) {
    errors.push("PAYMENT_MODE=mock is blocked in production unless ALLOW_PRODUCTION_MOCK_PAYMENTS=true is explicitly set.");
  }

  if (paymentMode === "gateway") {
    if (isPlaceholder(env.PAYMONGO_SECRET_KEY) || !env.PAYMONGO_SECRET_KEY?.startsWith("sk_")) {
      errors.push("PAYMONGO_SECRET_KEY must be configured when PAYMENT_MODE=gateway.");
    }

    if (isPlaceholder(env.PAYMONGO_PUBLIC_KEY) || !env.PAYMONGO_PUBLIC_KEY?.startsWith("pk_")) {
      errors.push("PAYMONGO_PUBLIC_KEY must be configured when PAYMENT_MODE=gateway.");
    }

    if (isPlaceholder(env.PAYMONGO_WEBHOOK_SECRET)) {
      errors.push("PAYMONGO_WEBHOOK_SECRET must be configured when PAYMENT_MODE=gateway.");
    }
  }

  return { isStrictProduction, errors };
}

export function assertServerEnvironment(env: EnvSource = process.env) {
  const result = validateServerEnvironment(env);

  if (result.errors.length > 0) {
    throw new Error(`Invalid server environment:\n- ${result.errors.join("\n- ")}`);
  }

  return result;
}
