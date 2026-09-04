import { ChevronDown } from "lucide-react";

import { isSafeFaqLink, type FaqAnswer, type FaqInline, type PublishedFaqTopic } from "@/features/faq/content";

function InlineContent({ content }: { content: FaqInline[] }) {
  return content.map((span, index) => {
    const text = span.strong ? <strong className="font-semibold text-stone-100">{span.text}</strong> : span.text;
    return span.href && isSafeFaqLink(span.href)
      ? <a key={index} className="rounded-sm text-amber-200 underline underline-offset-4 hover:text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300" href={span.href}>{text}</a>
      : <span key={index}>{text}</span>;
  });
}

export function FaqAnswerContent({ answer }: { answer: FaqAnswer }) {
  return <div className="space-y-3 break-words text-sm leading-7 text-stone-300 sm:text-base">
    {answer.blocks.map((block, index) => {
      if (block.type === "paragraph") return <p key={index}><InlineContent content={block.content} /></p>;
      const List = block.ordered ? "ol" : "ul";
      return <List key={index} className={`space-y-2 pl-5 ${block.ordered ? "list-decimal" : "list-disc"}`}>
        {block.items.map((item, itemIndex) => <li key={itemIndex}><InlineContent content={item} /></li>)}
      </List>;
    })}
  </div>;
}

export function FaqTopics({ topics }: { topics: PublishedFaqTopic[] }) {
  if (!topics.length) return <p className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-6 text-stone-300">No frequently asked questions are available yet. Please check back soon.</p>;

  return <div className="space-y-3 sm:space-y-4">
    {topics.map((topic) => <details key={topic.slug} className="group rounded-3xl border border-white/10 bg-white/5 open:border-amber-300/40 open:bg-amber-300/5">
      <summary id={`faq-${topic.slug}-heading`} aria-controls={`faq-${topic.slug}-panel`} className="cursor-pointer list-none rounded-3xl p-5 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300 sm:p-6 [&::-webkit-details-marker]:hidden">
        <h2 className="flex items-center justify-between gap-4 text-base font-semibold text-white sm:text-lg">
          {topic.title}
          <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-amber-300 group-open:rotate-180 motion-safe:transition-transform" />
        </h2>
      </summary>
      <div id={`faq-${topic.slug}-panel`} role="region" aria-labelledby={`faq-${topic.slug}-heading`} className="space-y-6 border-t border-white/10 px-5 py-6 sm:px-6">
        {topic.description ? <p className="text-sm leading-7 text-stone-300">{topic.description}</p> : null}
        {topic.items.length ? topic.items.map((item) => <section key={item.slug} aria-labelledby={`faq-${topic.slug}-${item.slug}`} className="space-y-2">
          <h3 id={`faq-${topic.slug}-${item.slug}`} className="text-base font-semibold leading-7 text-white sm:text-lg">{item.question}</h3>
          <FaqAnswerContent answer={item.answer} />
        </section>) : <p className="text-sm text-stone-300">No questions are available in this topic yet.</p>}
      </div>
    </details>)}
  </div>;
}
