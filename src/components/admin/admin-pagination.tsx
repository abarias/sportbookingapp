"use client";

import { useRouter, useSearchParams } from "next/navigation";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export function AdminPagination({ basePath, page, pageSize, totalCount }: { basePath: string; page: number; pageSize: number; totalCount: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalCount);

  function navigate(nextPage: number, nextPageSize = pageSize) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    params.set("pageSize", String(nextPageSize));
    router.push(`${basePath}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-4 border-t border-white/10 px-5 py-4 text-sm text-stone-300 md:flex-row md:items-center md:justify-between">
      <p>Showing {startRecord}-{endRecord} of {totalCount}</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-stone-400">
          Rows per page
          <select className="rounded-xl border border-white/10 bg-stone-950 px-3 py-2 text-white outline-none transition focus:border-amber-300" value={pageSize} onChange={(event) => navigate(1, Number(event.target.value))}>
            {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button className="rounded-xl border border-white/10 px-3 py-2 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40" disabled={page <= 1} onClick={() => navigate(page - 1)} type="button">Previous</button>
          <span className="text-stone-400">Page {page} of {totalPages}</span>
          <button className="rounded-xl border border-white/10 px-3 py-2 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40" disabled={page >= totalPages} onClick={() => navigate(page + 1)} type="button">Next</button>
        </div>
      </div>
    </div>
  );
}
