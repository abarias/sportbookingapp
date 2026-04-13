import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-[60vh] flex-col items-start justify-center gap-4">
      <p className="text-sm uppercase tracking-[0.24em] text-amber-300">Forbidden</p>
      <h1 className="font-serif text-4xl text-white">You do not have access to that page.</h1>
      <p className="max-w-xl text-stone-300">Admin routes are restricted to internal staff accounts.</p>
      <Button asChild>
        <Link href="/">Return home</Link>
      </Button>
    </main>
  );
}
