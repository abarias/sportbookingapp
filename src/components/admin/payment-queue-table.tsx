"use client";

import { useRouter } from "next/navigation";

export type PaymentQueueRow = {
  id: string;
  customerName: string;
  customerContact: string;
  schedule: string;
  facilityName: string;
  amountDue: string;
  bookingReference: string;
  transferReference: string | null;
  paymentMethod: string;
  status: string;
  statusLabel: string;
  statusClassName: string;
  submitted: string;
  duplicateReference: boolean;
};

type PaymentQueueTableProps = {
  rows: PaymentQueueRow[];
};

export function PaymentQueueTable({ rows }: PaymentQueueTableProps) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1040px] text-left text-sm">
        <thead className="bg-stone-950/60 text-xs uppercase tracking-[0.16em] text-stone-500">
          <tr>
            <th className="px-5 py-3 font-medium">Customer</th>
            <th className="px-5 py-3 font-medium">Schedule</th>
            <th className="px-5 py-3 font-medium">Facility</th>
            <th className="px-5 py-3 font-medium">Amount</th>
            <th className="px-5 py-3 font-medium">Reference</th>
            <th className="px-5 py-3 font-medium">Method</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Submitted</th>
            <th className="px-5 py-3 font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map((row) => (
            <tr
              key={row.id}
              aria-label={`Review payment ${row.bookingReference} for ${row.customerName}`}
              className="cursor-pointer text-stone-300 transition hover:bg-white/5 focus:bg-white/5 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
              role="link"
              tabIndex={0}
              onClick={() => router.push(`/admin/payments/${row.id}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  router.push(`/admin/payments/${row.id}`);
                }
              }}
            >
              <td className="px-5 py-4">
                <p className="font-medium text-white">{row.customerName}</p>
                <p className="mt-1 text-xs text-stone-500">{row.customerContact}</p>
              </td>
              <td className="px-5 py-4">{row.schedule}</td>
              <td className="px-5 py-4 text-white">{row.facilityName}</td>
              <td className="px-5 py-4">
                <p>{row.amountDue}</p>
              </td>
              <td className="px-5 py-4">
                <p className="font-medium text-white">{row.bookingReference}</p>
                {row.transferReference ? <p className="text-xs text-stone-500">{row.transferReference}</p> : null}
                {row.duplicateReference ? <p className="mt-1 text-xs text-rose-300">Duplicate flag</p> : null}
              </td>
              <td className="px-5 py-4">{row.paymentMethod}</td>
              <td className="px-5 py-4">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-[0.14em] ${row.statusClassName}`}>
                  {row.statusLabel}
                </span>
              </td>
              <td className="px-5 py-4">{row.submitted}</td>
              <td className="px-5 py-4 text-amber-200">Review</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
