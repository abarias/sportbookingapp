import type { Metadata } from "next";

import { FaqTopics } from "@/components/faq/faq-topics";
import { SectionHeading } from "@/components/shared/section-heading";
import { getPublishedFaqs } from "@/server/faq/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Frequently asked questions | MMG Stellar" };

export default async function FaqPage() {
  const topics = await getPublishedFaqs();
  return <main className="mx-auto max-w-4xl space-y-6 pb-12 sm:space-y-8">
    <SectionHeading compact eyebrow="FAQs" title="Frequently asked questions" description="Choose a topic to find answers to your questions." />
    <FaqTopics topics={topics} />
  </main>;
}
