import { z } from "zod";

export function isSafeFaqLink(value: string) {
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:", "tel:"].includes(url.protocol);
  } catch {
    return false;
  }
}

const inlineSchema = z.object({
  text: z.string().min(1),
  strong: z.boolean().optional(),
  href: z.string().refine(isSafeFaqLink, "Only HTTP(S), email, or telephone links are allowed.").optional()
}).strict();
const contentSchema = z.array(inlineSchema).min(1);

export const faqAnswerSchema = z.object({
  version: z.literal(1),
  blocks: z.array(z.discriminatedUnion("type", [
    z.object({ type: z.literal("paragraph"), content: contentSchema }).strict(),
    z.object({ type: z.literal("list"), ordered: z.boolean(), items: z.array(contentSchema).min(1) }).strict()
  ])).min(1)
}).strict();

export type FaqAnswer = z.infer<typeof faqAnswerSchema>;
export type FaqInline = z.infer<typeof inlineSchema>;
export type PublishedFaqTopic = {
  slug: string;
  title: string;
  description: string | null;
  items: Array<{ slug: string; question: string; answer: FaqAnswer }>;
};
