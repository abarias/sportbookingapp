import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return <main className="mx-auto max-w-xl pb-16"><section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 sm:p-8"><p className="text-sm uppercase tracking-[0.24em] text-amber-300">Account recovery</p><h1 className="mt-3 font-serif text-4xl text-white">Reset your password.</h1><p className="mt-3 mb-8 text-stone-300">We will help you get back into your account securely.</p><ForgotPasswordForm /></section></main>;
}
