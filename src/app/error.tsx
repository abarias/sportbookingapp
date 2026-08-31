"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

type ErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("Application route error", error);
  }, [error]);

  return (
    <main className="flex min-h-[65vh] items-center justify-center py-12">
      <section className="w-full max-w-2xl rounded-[2rem] border border-amber-300/20 bg-stone-900/75 p-8 text-center shadow-2xl shadow-black/20 sm:p-12" role="alert">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/10 text-amber-200" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M10.3 3.9 2.7 17a2 2 0 0 0 1.74 3h15.12a2 2 0 0 0 1.74-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">A quick timeout</p>
        <h1 className="mt-3 font-serif text-4xl text-white sm:text-5xl">We hit a small snag.</h1>
        <p className="mx-auto mt-4 max-w-lg text-stone-300">
          This page could not load right now. Please try again, or head back home while we get things back on track.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button type="button" onClick={() => reset()}>Try again</Button>
          <Button asChild variant="secondary">
            <Link href="/">Go to home</Link>
          </Button>
        </div>
        <p className="mt-6 text-xs text-stone-500">If the problem continues, please try again later or contact the facility.</p>
      </section>
    </main>
  );
}
