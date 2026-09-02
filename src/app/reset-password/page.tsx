import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <main className="mx-auto max-w-xl pb-16"><section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 sm:p-8"><p className="text-sm uppercase tracking-[0.24em] text-amber-300">Account recovery</p><h1 className="mt-3 font-serif text-4xl text-white">Choose a new password.</h1><p className="mt-3 mb-8 text-stone-300">This link can only be used once and expires after 30 minutes.</p>{token ? <ResetPasswordForm token={token} /> : <p className="rounded-2xl border border-rose-300/30 bg-rose-300/10 p-4 text-sm text-rose-100">This password reset link is missing or invalid.</p>}</section></main>;
}
