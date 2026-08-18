"use client";

import { useRouter, useSearchParams } from "next/navigation";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export function BookingHistoryPagination(props: {
  page: number;
  pageSize: number;
  totalCount: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(props.totalCount / props.pageSize));
  const startRecord = props.totalCount === 0 ? 0 : (props.page - 1) * props.pageSize + 1;
  const endRecord = Math.min(props.page * props.pageSize, props.totalCount);

  function updateParams(nextValues: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(nextValues)) {
      params.set(key, value);
    }

    router.push(`/bookings?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-4 border-t border-white/10 pt-4 text-sm text-stone-300 md:flex-row md:items-center md:justify-between">
      <p>
        Showing {startRecord}-{endRecord} of {props.totalCount}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-stone-400">
          Rows per page
          <select
            className="rounded-xl border border-white/10 bg-stone-950 px-3 py-2 text-white outline-none transition focus:border-amber-300"
            value={props.pageSize}
            onChange={(event) => updateParams({ historyPage: "1", historyPageSize: event.target.value })}
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <button
            className="rounded-xl border border-white/10 px-3 py-2 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            disabled={props.page <= 1}
            onClick={() => updateParams({ historyPage: String(props.page - 1), historyPageSize: String(props.pageSize) })}
          >
            Previous
          </button>
          <span className="text-stone-400">
            Page {props.page} of {totalPages}
          </span>
          <button
            className="rounded-xl border border-white/10 px-3 py-2 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            disabled={props.page >= totalPages}
            onClick={() => updateParams({ historyPage: String(props.page + 1), historyPageSize: String(props.pageSize) })}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
