type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function SectionHeading({ eyebrow, title, description }: SectionHeadingProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm uppercase tracking-[0.24em] text-amber-300">{eyebrow}</p>
      <div className="space-y-2">
        <h1 className="font-serif text-3xl text-white sm:text-4xl">{title}</h1>
        <p className="max-w-3xl text-sm leading-7 text-stone-300 sm:text-base">{description}</p>
      </div>
    </div>
  );
}
