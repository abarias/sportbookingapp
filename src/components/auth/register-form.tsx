"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { registerUserAction, type RegisterActionState } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: RegisterActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full" disabled={pending} type="submit">
      {pending ? "Creating account..." : "Create customer account"}
    </Button>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(registerUserAction, initialState);

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input autoComplete="name" id="fullName" maxLength={120} minLength={2} name="fullName" placeholder="Juan Dela Cruz" required />
        {state.fieldErrors?.fullName ? <p className="text-sm text-rose-300">{state.fieldErrors.fullName}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input autoComplete="email" id="email" maxLength={255} name="email" placeholder="you@example.com" required type="email" />
        {state.fieldErrors?.email ? <p className="text-sm text-rose-300">{state.fieldErrors.email}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input autoComplete="new-password" id="password" maxLength={72} minLength={8} name="password" required type="password" />
        {state.fieldErrors?.password ? <p className="text-sm text-rose-300">{state.fieldErrors.password}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input autoComplete="new-password" id="confirmPassword" maxLength={72} minLength={8} name="confirmPassword" required type="password" />
        {state.fieldErrors?.confirmPassword ? (
          <p className="text-sm text-rose-300">{state.fieldErrors.confirmPassword}</p>
        ) : null}
      </div>

      {state.message ? <p className="text-sm text-rose-300">{state.message}</p> : null}

      <SubmitButton />

      <p className="text-sm text-stone-400">
        Already have an account?{" "}
        <Link href="/login" className="text-amber-300 hover:text-amber-200">
          Sign in
        </Link>
      </p>
    </form>
  );
}
