"use client";

import Link from "next/link";
import { useActionState } from "react";

import { resetPasswordAction, type PasswordActionState } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: PasswordActionState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialState);
  return (
    <form action={action} className="space-y-5">
      <input name="token" type="hidden" value={token} />
      <div className="space-y-2"><Label htmlFor="password">New password</Label><Input autoComplete="new-password" id="password" maxLength={72} minLength={10} name="password" required type="password" /><p className="text-xs text-stone-400">Use at least 10 characters with letters and numbers. Avoid common passwords and personal details.</p></div>
      <div className="space-y-2"><Label htmlFor="confirmPassword">Confirm new password</Label><Input autoComplete="new-password" id="confirmPassword" maxLength={72} minLength={10} name="confirmPassword" required type="password" /></div>
      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.success ? <div className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm text-emerald-100">{state.success} <Link className="text-amber-200 underline" href="/login">Sign in</Link></div> : null}
      <Button className="w-full" disabled={pending || Boolean(state.success)} type="submit">{pending ? "Saving..." : "Set new password"}</Button>
    </form>
  );
}
