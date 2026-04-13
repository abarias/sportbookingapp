type DashboardStatProps = {
  label: string;
  value: string;
  hint: string;
};

export function DashboardStat({ label, value, hint }: DashboardStatProps) {
  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
      <p className="text-sm text-stone-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-amber-300">{hint}</p>
    </article>
  );
}
