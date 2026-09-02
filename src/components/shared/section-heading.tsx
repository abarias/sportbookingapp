type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  compact?: boolean;
};

export function SectionHeading({ eyebrow, title, description, compact = false }: SectionHeadingProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm uppercase tracking-[0.24em] text-amber-300">{eyebrow}</p>
      <div className="space-y-2">
        <h1 className={`font-serif text-white ${compact ? "text-2xl sm:text-4xl" : "text-3xl sm:text-4xl"}`}>{title}</h1>
        <p className={`max-w-3xl text-sm text-stone-300 ${compact ? "leading-6 sm:text-base sm:leading-7" : "leading-7 sm:text-base"}`}>{description}</p>
      </div>
    </div>
  );
}
