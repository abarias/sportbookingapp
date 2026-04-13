"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema } from "@/features/auth/schemas";

type LoginFormProps = {
  callbackUrl?: string;
  registered?: boolean;
};

export function LoginForm({ callbackUrl = "/facilities", registered = false }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const normalizedCallbackUrl = callbackUrl.startsWith("/") ? callbackUrl : "/facilities";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const parsed = loginSchema.safeParse({
      email,
      password,
      callbackUrl: normalizedCallbackUrl
    });

    if (!parsed.success) {
      setErrorMessage("Enter a valid email and password.");
      return;
    }

    setIsSubmitting(true);

    const result = await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false
    });

    setIsSubmitting(false);

    if (!result || result.error) {
      setErrorMessage("Incorrect email or password.");
      return;
    }

    window.location.href = normalizedCallbackUrl;
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {registered ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          Account created. Sign in to continue.
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          autoComplete="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          autoComplete="current-password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </div>

      {errorMessage ? <p className="text-sm text-rose-300">{errorMessage}</p> : null}

      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>

      <p className="text-sm text-stone-400">
        Need an account?{" "}
        <Link href="/register" className="text-amber-300 hover:text-amber-200">
          Create one
        </Link>
      </p>
    </form>
  );
}
