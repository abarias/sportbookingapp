import { LoginForm } from "@/components/auth/login-form";

type LoginPageProps = {
  searchParams: Promise<{
    callbackUrl?: string;
    registered?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="mx-auto grid max-w-5xl gap-10 pb-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
      <section className="space-y-4">
        <p className="text-sm uppercase tracking-[0.24em] text-amber-300">Customer and Admin Access</p>
        <h1 className="font-serif text-4xl text-white sm:text-5xl">Sign in to manage bookings and internal operations.</h1>
        <p className="max-w-xl text-base leading-7 text-stone-300">
          Phase 2 adds credentials-based authentication backed by Prisma and PostgreSQL. Admin access is seeded for
          internal staff only.
        </p>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 sm:p-8">
        <LoginForm callbackUrl={params.callbackUrl} registered={params.registered === "1"} />
      </section>
    </main>
  );
}
