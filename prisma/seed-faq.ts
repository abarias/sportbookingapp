import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedFaqs } from "./faq-content";

const prisma = new PrismaClient();
seedFaqs(prisma)
  .then((result) => console.log(`FAQ import complete: ${result.topics} topics and ${result.items} items processed. Existing records preserved.`))
  .catch((error: unknown) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
