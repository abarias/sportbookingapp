export const COMMON_WEAK_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "qwerty123",
  "admin12345",
  "letmein123",
  "welcome123",
  "1234567890",
  "123456789"
]);

export function normalizedPasswordValue(value: string) {
  return value.trim().toLowerCase();
}

export function significantNameParts(fullName: string) {
  return fullName
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.replace(/[^a-z0-9]/g, ""))
    .filter((part) => part.length >= 3);
}

export function getPasswordValidationMessage(params: {
  password: string;
  confirmPassword?: string;
  fullName?: string;
  email?: string;
}) {
  const normalizedPassword = normalizedPasswordValue(params.password);
  const emailLocalPart = params.email?.split("@")[0]?.toLowerCase() ?? "";

  if (params.password.length < 10) {
    return "Use at least 10 characters.";
  }

  if (!/[A-Za-z]/.test(params.password)) {
    return "Use at least one letter.";
  }

  if (!/\d/.test(params.password)) {
    return "Use at least one number.";
  }

  if (COMMON_WEAK_PASSWORDS.has(normalizedPassword)) {
    return "Choose a less common password.";
  }

  if (emailLocalPart.length >= 3 && normalizedPassword.includes(emailLocalPart)) {
    return "Do not include your email address in your password.";
  }

  if (params.fullName && significantNameParts(params.fullName).some((part) => normalizedPassword.includes(part))) {
    return "Do not include your name in your password.";
  }

  if (params.confirmPassword !== undefined && params.password !== params.confirmPassword) {
    return "Passwords do not match.";
  }

  return null;
}
