"use client";

import { useActionState } from "react";

import { changePasswordAction, type PasswordActionState } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: PasswordActionState = {};

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initialState);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="currentPassword">Current password</Label><Input autoComplete="current-password" id="currentPassword" name="currentPassword" required type="password" /></div>
      <div className="space-y-2"><Label htmlFor="accountPassword">New password</Label><Input autoComplete="new-password" id="accountPassword" maxLength={72} minLength={10} name="password" required type="password" /></div>
      <div className="space-y-2"><Label htmlFor="accountConfirmPassword">Confirm new password</Label><Input autoComplete="new-password" id="accountConfirmPassword" maxLength={72} minLength={10} name="confirmPassword" required type="password" /></div>
      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}
      {state.success ? <p aria-live="polite" className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm text-emerald-100">{state.success}</p> : null}
      <Button disabled={pending} type="submit">{pending ? "Updating..." : "Change password"}</Button>
    </form>
  );
}
