import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-start justify-center gap-4">
      <p className="text-sm uppercase tracking-[0.24em] text-amber-300">Not found</p>
      <h1 className="font-serif text-4xl text-white">That page is not available.</h1>
      <p className="max-w-xl text-stone-300">The route may not be implemented yet or the facility record does not exist.</p>
      <Button asChild>
        <Link href="/">Return home</Link>
      </Button>
    </main>
  );
}
