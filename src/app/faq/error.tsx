"use client";

import { Button } from "@/components/ui/button";

export default function FaqError() {
  return <main className="mx-auto max-w-4xl space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6" role="alert">
    <h1 className="font-serif text-2xl text-white">Frequently asked questions are temporarily unavailable</h1>
    <p className="text-stone-300">Please try loading this page again.</p>
    <Button asChild><a href="/faq">Try again</a></Button>
  </main>;
}
