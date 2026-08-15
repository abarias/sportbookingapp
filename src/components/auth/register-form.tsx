"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { getPasswordValidationMessage } from "@/features/auth/password-policy";
import { registerUserAction, type RegisterActionState, verifyRegistrationEmailAction, type VerifyEmailActionState } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: RegisterActionState = {};
const initialVerificationState: VerifyEmailActionState = {};

function SubmitButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full" disabled={pending || disabled} type="submit">
      {pending ? "Creating account..." : "Create customer account"}
    </Button>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(registerUserAction, initialState);
  const [verificationState, verificationAction] = useActionState(verifyRegistrationEmailAction, initialVerificationState);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [clientErrors, setClientErrors] = useState<Partial<Record<"password" | "confirmPassword", string>>>({});

  const passwordError = getPasswordValidationMessage({
    password,
    fullName,
    email
  });
  const confirmPasswordError = confirmPassword && password !== confirmPassword ? "Passwords do not match." : null;
  const hasClientPasswordError = Boolean(password && passwordError) || Boolean(confirmPasswordError);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const nextClientErrors: Partial<Record<"password" | "confirmPassword", string>> = {};
    const passwordMessage = getPasswordValidationMessage({
      password,
      fullName,
      email
    });

    if (passwordMessage) {
      nextClientErrors.password = passwordMessage;
    }

    if (password !== confirmPassword) {
      nextClientErrors.confirmPassword = "Passwords do not match.";
    }

    setClientErrors(nextClientErrors);

    if (Object.keys(nextClientErrors).length > 0) {
      event.preventDefault();
    }
  }

  if (state.pendingEmail) {
    return (
      <form action={verificationAction} className="space-y-5">
        <input name="email" type="hidden" value={state.pendingEmail} />
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          We sent a verification code to your email. Verify your email before signing in or making a booking.
          {state.devVerificationCode ? <span className="block pt-2 text-xs text-amber-200">Development code: {state.devVerificationCode}</span> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="registrationVerificationCode">Email verification code</Label>
          <Input
            autoComplete="one-time-code"
            id="registrationVerificationCode"
            inputMode="numeric"
            maxLength={6}
            minLength={6}
            name="code"
            onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            pattern="[0-9]{6}"
            placeholder="123456"
            required
            type="text"
            value={verificationCode}
          />
          {verificationState.fieldErrors?.code ? <p className="text-sm text-rose-300">{verificationState.fieldErrors.code}</p> : null}
        </div>
        {verificationState.message ? <p className="text-sm text-rose-300">{verificationState.message}</p> : null}
        {verificationState.success ? <p className="text-sm text-emerald-300">{verificationState.success}</p> : null}
        <Button className="w-full" type="submit">Verify email</Button>
        <p className="text-sm text-stone-400">
          Need another code?{" "}
          <Link href="/verify-email" className="text-amber-300 hover:text-amber-200">
            Resend verification email
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          autoComplete="name"
          id="fullName"
          maxLength={120}
          minLength={2}
          name="fullName"
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Juan Dela Cruz"
          required
          value={fullName}
        />
        {state.fieldErrors?.fullName ? <p className="text-sm text-rose-300">{state.fieldErrors.fullName}</p> : null}
      </div>

      <div className="hidden" aria-hidden="true">
        <Label htmlFor="companyWebsite">Company website</Label>
        <Input id="companyWebsite" name="companyWebsite" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          autoComplete="email"
          id="email"
          maxLength={255}
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
        {state.fieldErrors?.email ? <p className="text-sm text-rose-300">{state.fieldErrors.email}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Mobile number</Label>
        <Input
          autoComplete="tel"
          id="phone"
          name="phone"
          onChange={(event) => setPhone(event.target.value)}
          placeholder="09171234567"
          required
          type="tel"
          value={phone}
        />
        {state.fieldErrors?.phone ? <p className="text-sm text-rose-300">{state.fieldErrors.phone}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          aria-invalid={Boolean(clientErrors.password || (password && passwordError))}
          autoComplete="new-password"
          id="password"
          maxLength={72}
          minLength={10}
          name="password"
          onChange={(event) => {
            setPassword(event.target.value);
            setClientErrors((current) => ({ ...current, password: undefined }));
          }}
          required
          type="password"
          value={password}
        />
        <p className="text-xs leading-5 text-stone-400">
          Use at least 10 characters with letters and numbers. Avoid common passwords and anything based on your name or email.
        </p>
        {password && passwordError ? <p className="text-sm text-rose-300">{passwordError}</p> : null}
        {state.fieldErrors?.password ? <p className="text-sm text-rose-300">{state.fieldErrors.password}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          aria-invalid={Boolean(clientErrors.confirmPassword || confirmPasswordError)}
          autoComplete="new-password"
          id="confirmPassword"
          maxLength={72}
          minLength={10}
          name="confirmPassword"
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setClientErrors((current) => ({ ...current, confirmPassword: undefined }));
          }}
          required
          type="password"
          value={confirmPassword}
        />
        {confirmPasswordError ? <p className="text-sm text-rose-300">{confirmPasswordError}</p> : null}
        {state.fieldErrors?.confirmPassword ? (
          <p className="text-sm text-rose-300">{state.fieldErrors.confirmPassword}</p>
        ) : null}
      </div>

      {state.message ? <p className="text-sm text-rose-300">{state.message}</p> : null}

      <SubmitButton disabled={hasClientPasswordError} />

      <p className="text-sm text-stone-400">
        Already have an account?{" "}
        <Link href="/login" className="text-amber-300 hover:text-amber-200">
          Sign in
        </Link>
      </p>
      <p className="text-sm text-stone-400">
        Already registered but not verified?{" "}
        <Link href="/verify-email" className="text-amber-300 hover:text-amber-200">
          Request a new code
        </Link>
      </p>
    </form>
  );
}
