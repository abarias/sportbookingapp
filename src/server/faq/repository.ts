import type { PrismaClient, Prisma } from "@prisma/client";

import { faqAnswerSchema, type PublishedFaqTopic } from "@/features/faq/content";

export async function selectPublishedFaqs(db: Pick<PrismaClient | Prisma.TransactionClient, "faqTopic">): Promise<PublishedFaqTopic[]> {
  const topics = await db.faqTopic.findMany({
    where: { isPublished: true },
    orderBy: [{ displayOrder: "asc" }, { slug: "asc" }],
    select: {
      slug: true, title: true, description: true,
      items: {
        where: { isPublished: true },
        orderBy: [{ displayOrder: "asc" }, { slug: "asc" }],
        select: { slug: true, question: true, answer: true }
      }
    }
  });
  return topics.map((topic) => ({
    ...topic,
    items: topic.items.map((item) => ({ ...item, answer: faqAnswerSchema.parse(item.answer) }))
  }));
}
