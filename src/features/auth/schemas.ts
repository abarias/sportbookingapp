import { z } from "zod";

import { getPasswordValidationMessage } from "./password-policy";

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
  callbackUrl: z.string().optional()
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(255),
    phone: z
      .string()
      .trim()
      .regex(/^(\+63|0)9\d{9}$/, "Enter a valid Philippine mobile number."),
    password: z
      .string()
      .min(10, "Use at least 10 characters.")
      .max(72)
      .regex(/[A-Za-z]/, "Use at least one letter.")
      .regex(/\d/, "Use at least one number."),
    confirmPassword: z.string().min(10).max(72),
    companyWebsite: z.string().max(0).optional()
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match.",
        path: ["confirmPassword"]
      });
    }

    const passwordMessage = getPasswordValidationMessage({
      password: data.password,
      fullName: data.fullName,
      email: data.email
    });

    if (passwordMessage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: passwordMessage,
        path: ["password"]
      });
    }
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const verifyEmailSchema = z.object({
  email: z.string().trim().email().max(255),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code.")
});

export const resendVerificationEmailSchema = z.object({
  email: z.string().trim().email().max(255)
});
