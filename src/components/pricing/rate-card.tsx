import { formatCurrency } from "@/lib/formatting/currency";
import type { RateCardRow } from "@/server/pricing/types";

export function RateCard({ rows, compact = false }: { rows: RateCardRow[]; compact?: boolean }) {
  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-stone-950/40" aria-labelledby="rate-card-title">
      <div className="border-b border-white/10 p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Facility pricing</p>
        <h2 className="mt-2 text-xl font-semibold text-white" id="rate-card-title">Base rate card</h2>
        <p className="mt-2 text-sm leading-6 text-stone-300">All rates shown are base prices and are exclusive of VAT.</p>
      </div>
      {rows.length === 0 ? (
        <p className="p-5 text-sm text-stone-400">A public rate card is not currently available. Contact the facility before booking.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-[0.14em] text-stone-400">
              <tr>
                <th className="px-4 py-3 font-medium">Applicable days</th>
                <th className="px-4 py-3 font-medium">Time</th>
                {!compact ? <th className="px-4 py-3 font-medium">Rate</th> : null}
                <th className="px-4 py-3 text-right font-medium">Base rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className="px-4 py-4 text-white">
                    {row.applicableDays}
                    {row.effectiveLabel ? <span className="mt-1 block text-xs text-amber-200">{row.effectiveLabel}</span> : null}
                  </td>
                  <td className="px-4 py-4 text-stone-300">{row.timeLabel}</td>
                  {!compact ? <td className="px-4 py-4 text-stone-300">{row.rateLabel}</td> : null}
                  <td className="px-4 py-4 text-right font-semibold text-white">
                    {formatCurrency(row.amountMinor, "PHP")}
                    <span className="block text-xs font-normal text-stone-400">{row.unitLabel}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-white/10 p-4 text-xs leading-5 text-stone-400">Final base price depends on the selected date, time, and duration.</p>
    </section>
  );
}
