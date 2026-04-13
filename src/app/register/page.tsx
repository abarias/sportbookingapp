import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <main className="mx-auto grid max-w-5xl gap-10 pb-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
      <section className="space-y-4">
        <p className="text-sm uppercase tracking-[0.24em] text-amber-300">Create Account</p>
        <h1 className="font-serif text-4xl text-white sm:text-5xl">Register as a customer to book courts online.</h1>
        <p className="max-w-xl text-base leading-7 text-stone-300">
          Self-registration creates customer accounts only. Admin users are seeded and managed internally for MVP.
        </p>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 sm:p-8">
        <RegisterForm />
      </section>
    </main>
  );
}
