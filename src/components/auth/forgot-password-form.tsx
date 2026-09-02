"use client";

import Link from "next/link";
import { useActionState } from "react";

import { requestPasswordResetAction, type PasswordActionState } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: PasswordActionState = {};

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initialState);
  return (
    <form action={action} className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-300">Enter your account email and we will send a password reset link if an account matches.</div>
      <div className="space-y-2"><Label htmlFor="email">Email</Label><Input autoComplete="email" id="email" name="email" required type="email" /></div>
      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.success ? <div className="space-y-2 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm text-emerald-100"><p>{state.success}</p>{state.resetUrl ? <Link className="break-all text-amber-200 underline" href={state.resetUrl}>Open the local reset link</Link> : null}</div> : null}
      <Button className="w-full" disabled={pending} type="submit">{pending ? "Sending..." : "Send reset link"}</Button>
      <p className="text-sm text-stone-400"><Link className="text-amber-200 hover:underline" href="/login">Back to sign in</Link></p>
    </form>
  );
}
