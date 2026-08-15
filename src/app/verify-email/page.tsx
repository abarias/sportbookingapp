import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export default function VerifyEmailPage() {
  return (
    <main className="mx-auto grid max-w-5xl gap-10 pb-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
      <section className="space-y-4">
        <p className="text-sm uppercase tracking-[0.24em] text-amber-300">Verify Email</p>
        <h1 className="font-serif text-4xl text-white sm:text-5xl">Finish setting up your customer account.</h1>
        <p className="max-w-xl text-base leading-7 text-stone-300">
          Request a fresh verification code if your previous code expired or you closed the registration screen.
        </p>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 sm:p-8">
        <VerifyEmailForm />
      </section>
    </main>
  );
}
