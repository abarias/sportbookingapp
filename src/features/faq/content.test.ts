import { describe, expect, it } from "vitest";
import { faqAnswerSchema } from "./content";
import { faqImportSchema } from "../../../prisma/faq-content";
import data from "../../../prisma/data/faq.json";

describe("FAQ source import", () => {
  it("includes all reviewed PDF topics and questions in source order", () => {
    const parsed = faqImportSchema.parse(data);
    expect(parsed.topics.map((topic) => topic.items.length)).toEqual([1, 6, 4, 4, 6, 6, 4, 2, 3]);
    expect(parsed.topics.map((topic) => topic.title)).toEqual(["OPERATING HOURS", "BOOKING & RESERVATIONS", "PAYMENT & RATES", "CANCELLATIONS & CHANGES", "REFUNDS", "FACILITY USE", "SAFETY & HOUSE RULES", "PERSONAL BELONGINGS", "GROUPS & EVENTS"]);
    const content = JSON.stringify(parsed.topics);
    expect(content).not.toMatch(/@AB|@CLL|Payment Details/);
    expect(content).toContain("Reschedule requests may be directed to our front desk");
    expect(content).toContain("violation of facility rules. Applicable repair or replacement costs may be charged.");
    expect(parsed.topics[3].items[0].answer.blocks[1].type).toBe("list");
  });

  it("rejects duplicate slugs and malformed or unsupported content before import", () => {
    const duplicate = structuredClone(data);
    duplicate.topics.push(duplicate.topics[0]);
    expect(() => faqImportSchema.parse(duplicate)).toThrow("Duplicate topic slug");
    const duplicateItem = structuredClone(faqImportSchema.parse(data));
    duplicateItem.topics[0].items.push(duplicateItem.topics[0].items[0]);
    expect(() => faqImportSchema.parse(duplicateItem)).toThrow("Duplicate item slug");
    expect(faqAnswerSchema.safeParse({ version: 1, blocks: [] }).success).toBe(false);
    expect(faqAnswerSchema.safeParse({ version: 1, blocks: [{ type: "html", html: "<script>alert(1)</script>" }] }).success).toBe(false);
  });

  it("accepts safe links and rejects executable URL protocols", () => {
    for (const href of ["javascript:alert(1)", "data:text/html,test", "//example.com"]) {
      expect(faqAnswerSchema.safeParse({ version: 1, blocks: [{ type: "paragraph", content: [{ text: "Click", href }] }] }).success).toBe(false);
    }
  });
});
