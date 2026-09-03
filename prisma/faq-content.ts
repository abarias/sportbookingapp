import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import sourceData from "./data/faq.json";
import { faqAnswerSchema } from "../src/features/faq/content";

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const item = z.object({
  slug, question: z.string().trim().min(1), answer: faqAnswerSchema,
  sourceNumber: z.number().int().positive().nullable(),
  sourcePages: z.array(z.number().int().positive()).min(1)
}).strict();

export const faqImportSchema = z.object({
  source: z.object({ file: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/), section: z.string(), notes: z.array(z.string()) }).strict(),
  topics: z.array(z.object({ slug, title: z.string().trim().min(1), items: z.array(item).min(1) }).strict()).min(1)
}).strict().superRefine((data, ctx) => {
  const topics = new Set<string>();
  data.topics.forEach((topic, topicIndex) => {
    if (topics.has(topic.slug)) ctx.addIssue({ code: "custom", message: "Duplicate topic slug", path: ["topics", topicIndex, "slug"] });
    topics.add(topic.slug);
    const items = new Set<string>();
    topic.items.forEach((entry, itemIndex) => {
      if (items.has(entry.slug)) ctx.addIssue({ code: "custom", message: "Duplicate item slug within topic", path: ["topics", topicIndex, "items", itemIndex, "slug"] });
      items.add(entry.slug);
    });
  });
});

export async function seedFaqs(prisma: PrismaClient, input: unknown = sourceData) {
  // Validate the entire import before writing anything. Existing CMS edits,
  // publication flags, and order are deliberately preserved on subsequent runs.
  const data = faqImportSchema.parse(input);
  await prisma.$transaction(async (tx) => {
    for (const [displayOrder, topic] of data.topics.entries()) {
      const saved = await tx.faqTopic.upsert({
        where: { slug: topic.slug }, update: {},
        create: { slug: topic.slug, title: topic.title, displayOrder, isPublished: true }
      });
      for (const [itemOrder, entry] of topic.items.entries()) {
        await tx.faqItem.upsert({
          where: { topicId_slug: { topicId: saved.id, slug: entry.slug } }, update: {},
          create: { topicId: saved.id, slug: entry.slug, question: entry.question, answer: entry.answer, displayOrder: itemOrder, isPublished: true }
        });
      }
    }
  }, { timeout: 30_000 });
  return { topics: data.topics.length, items: data.topics.reduce((count, topic) => count + topic.items.length, 0) };
}
