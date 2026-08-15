const DEFAULT_AUTH_CONFIG = {
  registrationWindowMinutes: 15,
  maxRegistrationAttempts: 5,
  emailVerificationExpiryMinutes: 15,
  maxEmailVerificationAttempts: 5,
  resendVerificationWindowMinutes: 10,
  maxResendVerificationAttempts: 3,
  verificationTokenRetentionDays: 7,
  registrationAttemptRetentionDays: 90
} as const;

function envPositiveInteger(key: string, fallback: number) {
  const rawValue = process.env[key];

  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAuthConfig() {
  return {
    registrationWindowMinutes: envPositiveInteger(
      "AUTH_REGISTRATION_WINDOW_MINUTES",
      DEFAULT_AUTH_CONFIG.registrationWindowMinutes
    ),
    maxRegistrationAttempts: envPositiveInteger(
      "AUTH_MAX_REGISTRATION_ATTEMPTS",
      DEFAULT_AUTH_CONFIG.maxRegistrationAttempts
    ),
    emailVerificationExpiryMinutes: envPositiveInteger(
      "AUTH_EMAIL_VERIFICATION_EXPIRY_MINUTES",
      DEFAULT_AUTH_CONFIG.emailVerificationExpiryMinutes
    ),
    maxEmailVerificationAttempts: envPositiveInteger(
      "AUTH_MAX_EMAIL_VERIFICATION_ATTEMPTS",
      DEFAULT_AUTH_CONFIG.maxEmailVerificationAttempts
    ),
    resendVerificationWindowMinutes: envPositiveInteger(
      "AUTH_RESEND_VERIFICATION_WINDOW_MINUTES",
      DEFAULT_AUTH_CONFIG.resendVerificationWindowMinutes
    ),
    maxResendVerificationAttempts: envPositiveInteger(
      "AUTH_MAX_RESEND_VERIFICATION_ATTEMPTS",
      DEFAULT_AUTH_CONFIG.maxResendVerificationAttempts
    ),
    verificationTokenRetentionDays: envPositiveInteger(
      "AUTH_VERIFICATION_TOKEN_RETENTION_DAYS",
      DEFAULT_AUTH_CONFIG.verificationTokenRetentionDays
    ),
    registrationAttemptRetentionDays: envPositiveInteger(
      "AUTH_REGISTRATION_ATTEMPT_RETENTION_DAYS",
      DEFAULT_AUTH_CONFIG.registrationAttemptRetentionDays
    )
  };
}

export function minutesToMilliseconds(minutes: number) {
  return minutes * 60_000;
}
