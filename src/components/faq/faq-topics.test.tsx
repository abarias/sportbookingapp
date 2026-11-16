import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FaqAnswerContent, FaqTopics } from "./faq-topics";
import FaqError from "@/app/faq/error";

describe("FAQ rendering", () => {
  it("provides an empty state", () => {
    expect(renderToStaticMarkup(<FaqTopics topics={[]} />)).toContain("No frequently asked questions are available yet");
  });

  it("escapes HTML and preserves lists, paragraphs, emphasis and links", () => {
    const html = renderToStaticMarkup(<FaqAnswerContent answer={{ version: 1, blocks: [
      { type: "paragraph", content: [{ text: "<script>alert(1)</script>" }, { text: "Important", strong: true }] },
      { type: "list", ordered: true, items: [[{ text: "Contact", href: "mailto:example@example.com" }]] }
    ] }} />);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<strong");
    expect(html).toContain("<ol");
    expect(html).toContain('href="mailto:example@example.com"');
  });

  it("renders a safe retry state", () => {
    const html = renderToStaticMarkup(<FaqError />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('href="/faq"');
    expect(html).toContain("temporarily unavailable");
  });
});
