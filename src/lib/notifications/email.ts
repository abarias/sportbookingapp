import { Resend } from "resend";

import { isLocalMockOtpAllowed } from "@/lib/config/env";

type VerificationEmailParams = {
  to: string;
  fullName: string;
  code: string;
  expiresInMinutes: number;
};

type PasswordResetEmailParams = {
  to: string;
  fullName: string;
  resetUrl: string;
  expiresInMinutes: number;
};

type EmailDeliveryResult = {
  delivered: boolean;
  provider: "console" | "resend";
  providerMessageId?: string;
};

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  return apiKey && from ? { apiKey, from } : null;
}

function buildVerificationEmailHtml(params: VerificationEmailParams) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1c1917">
      <h1 style="font-size:24px;margin-bottom:16px">Verify your MMG Stellar account</h1>
      <p>Hi ${params.fullName},</p>
      <p>Use this verification code to finish creating your account:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:0.2em;margin:24px 0">${params.code}</p>
      <p>This code expires in ${params.expiresInMinutes} minutes.</p>
      <p>If you did not request this account, you can ignore this email.</p>
    </div>
  `;
}

function buildVerificationEmailText(params: VerificationEmailParams) {
  return [
    `Hi ${params.fullName},`,
    "",
    "Use this verification code to finish creating your MMG Stellar account:",
    "",
    params.code,
    "",
    `This code expires in ${params.expiresInMinutes} minutes.`,
    "",
    "If you did not request this account, you can ignore this email."
  ].join("\n");
}

export async function sendVerificationEmail(params: VerificationEmailParams) {
  const resendConfig = getResendConfig();

  if (!resendConfig) {
    if (!isLocalMockOtpAllowed()) {
      throw new Error("Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.");
    }

    console.info(
      `[email:verification] to=${params.to} name="${params.fullName}" code=${params.code} expiresIn=${params.expiresInMinutes}m`
    );

    return { delivered: false, provider: "console" } satisfies EmailDeliveryResult;
  }

  const resend = new Resend(resendConfig.apiKey);
  const result = await resend.emails.send({
    from: resendConfig.from,
    to: params.to,
    subject: "Verify your MMG Stellar account",
    html: buildVerificationEmailHtml(params),
    text: buildVerificationEmailText(params)
  });

  if (result.error) {
    throw new Error(`Resend email delivery failed: ${result.error.message}`);
  }

  return {
    delivered: true,
    provider: "resend",
    providerMessageId: result.data?.id
  } satisfies EmailDeliveryResult;
}

export async function sendPasswordResetEmail(params: PasswordResetEmailParams) {
  const resendConfig = getResendConfig();
  if (!resendConfig) {
    if (!isLocalMockOtpAllowed()) throw new Error("Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.");
    console.info(`[email:password-reset] to=${params.to} expiresIn=${params.expiresInMinutes}m url=${params.resetUrl}`);
    return { delivered: false as const, provider: "console" as const };
  }

  const resend = new Resend(resendConfig.apiKey);
  const result = await resend.emails.send({
    from: resendConfig.from,
    to: params.to,
    subject: "Reset your MMG Stellar password",
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1c1917"><h1>Reset your password</h1><p>Hi ${params.fullName},</p><p>Use the link below to choose a new password. It expires in ${params.expiresInMinutes} minutes.</p><p><a href="${params.resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p></div>`,
    text: [`Hi ${params.fullName},`, "", `Reset your password: ${params.resetUrl}`, "", `This link expires in ${params.expiresInMinutes} minutes.`, "", "If you did not request this, you can ignore this email."].join("\n")
  });
  if (result.error) throw new Error(`Resend email delivery failed: ${result.error.message}`);
  return { delivered: true as const, provider: "resend" as const, providerMessageId: result.data?.id };
}

export async function sendBookingLifecycleEmail(params: { to: string; fullName: string; subject: string; heading: string; lines: string[] }) {
  const resendConfig = getResendConfig();
  const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  if (!resendConfig) {
    if (process.env.NODE_ENV === "production") throw new Error("Email delivery is not configured.");
    console.info(`[email:booking] to=${params.to} subject="${params.subject}"`);
    return { delivered: false as const, provider: "console" as const };
  }
  const resend = new Resend(resendConfig.apiKey);
  const result = await resend.emails.send({
    from: resendConfig.from,
    to: params.to,
    subject: params.subject,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1c1917"><h1>${escapeHtml(params.heading)}</h1><p>Hello ${escapeHtml(params.fullName)},</p>${params.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>`,
    text: [`${params.heading}`, `Hello ${params.fullName},`, ...params.lines].join("\n\n")
  });
  if (result.error) throw new Error(`Resend email delivery failed: ${result.error.message}`);
  return { delivered: true as const, provider: "resend" as const, id: result.data?.id ?? null };
}
