"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  resendVerificationEmailAction,
  type ResendVerificationEmailActionState,
  verifyRegistrationEmailAction,
  type VerifyEmailActionState
} from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialResendState: ResendVerificationEmailActionState = {};
const initialVerificationState: VerifyEmailActionState = {};

function ResendButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full" disabled={pending} type="submit">
      {pending ? "Sending code..." : "Send verification code"}
    </Button>
  );
}

function VerifyButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full" disabled={pending} type="submit">
      {pending ? "Verifying..." : "Verify email"}
    </Button>
  );
}

export function VerifyEmailForm() {
  const [resendState, resendAction] = useActionState(resendVerificationEmailAction, initialResendState);
  const [verificationState, verificationAction] = useActionState(verifyRegistrationEmailAction, initialVerificationState);
  const [verificationCode, setVerificationCode] = useState("");

  if (resendState.pendingEmail) {
    return (
      <form action={verificationAction} className="space-y-5">
        <input name="email" type="hidden" value={resendState.pendingEmail} />
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {resendState.message}
          {resendState.devVerificationCode ? (
            <span className="block pt-2 text-xs text-amber-200">Development code: {resendState.devVerificationCode}</span>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="resendVerificationCode">Email verification code</Label>
          <Input
            autoComplete="one-time-code"
            id="resendVerificationCode"
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
        <VerifyButton />
      </form>
    );
  }

  return (
    <form action={resendAction} className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-300">
        Enter the email address you used to register. If it needs verification, we will send a fresh code.
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input autoComplete="email" id="email" maxLength={255} name="email" placeholder="you@example.com" required type="email" />
        {resendState.fieldErrors?.email ? <p className="text-sm text-rose-300">{resendState.fieldErrors.email}</p> : null}
      </div>
      {resendState.message ? <p className="text-sm text-rose-300">{resendState.message}</p> : null}
      <ResendButton />
      <p className="text-sm text-stone-400">
        Already verified?{" "}
        <Link href="/login" className="text-amber-300 hover:text-amber-200">
          Sign in
        </Link>
      </p>
    </form>
  );
}
