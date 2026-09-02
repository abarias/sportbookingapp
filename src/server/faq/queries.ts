import "server-only";

import { prisma } from "@/lib/db/prisma";
import { selectPublishedFaqs } from "@/server/faq/repository";

export function getPublishedFaqs() {
  return selectPublishedFaqs(prisma);
}
