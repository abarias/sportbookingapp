"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

function RowsPerPageMenu({ pageSize, onChange, compact }: { pageSize: number; onChange: (pageSize: number) => void; compact: boolean }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  return (
    <div className={compact ? "relative min-w-0 flex-1" : "relative min-w-24 flex-none"} ref={menuRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-stone-950 px-3 py-2 text-left text-white outline-none transition hover:bg-white/10 focus:border-amber-300"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>{pageSize}</span>
        <span aria-hidden="true" className="text-stone-500">▾</span>
      </button>
      {open ? (
        <div aria-label="Rows per page" className="absolute bottom-[calc(100%+0.5rem)] left-0 z-30 w-full min-w-32 rounded-xl border border-white/10 bg-stone-900 p-1 shadow-2xl" role="listbox">
          {PAGE_SIZE_OPTIONS.map((option) => (
            <button
              aria-selected={pageSize === option}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/10 ${pageSize === option ? "bg-amber-400/15 text-amber-100" : "text-stone-300"}`}
              key={option}
              onClick={() => {
                setOpen(false);
                onChange(option);
              }}
              role="option"
              type="button"
            >
              {option} rows
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AdminPagination({ basePath, page, pageSize, totalCount, pageParam = "page", pageSizeParam = "pageSize", compact = false }: { basePath: string; page: number; pageSize: number; totalCount: number; pageParam?: string; pageSizeParam?: string; compact?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalCount);

  function navigate(nextPage: number, nextPageSize = pageSize) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(pageParam, String(nextPage));
    params.set(pageSizeParam, String(nextPageSize));
    router.push(`${basePath}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className={`flex flex-col gap-4 border-t border-white/10 px-5 py-4 text-sm text-stone-300 ${compact ? "items-stretch" : "md:flex-row md:items-center md:justify-between"}`}>
      <p className={compact ? "text-xs text-stone-400" : undefined}>Showing {startRecord}-{endRecord} of {totalCount}</p>
      <div className={`flex gap-3 ${compact ? "w-full flex-col items-stretch" : "flex-col sm:flex-row sm:items-center"}`}>
        <label className={`flex gap-2 text-stone-400 ${compact ? "w-full items-center justify-between" : "items-center"}`}>
          Rows per page
          <RowsPerPageMenu compact={compact} pageSize={pageSize} onChange={(nextPageSize) => navigate(1, nextPageSize)} />
        </label>
        <div className={`flex items-center gap-2 ${compact ? "grid grid-cols-[1fr_auto_1fr]" : ""}`}>
          <button className={`rounded-xl border border-white/10 px-3 py-2 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 ${compact ? "w-full text-xs" : ""}`} disabled={page <= 1} onClick={() => navigate(page - 1)} type="button">Previous</button>
          <span className={`text-stone-400 ${compact ? "whitespace-nowrap text-center text-xs" : ""}`}>Page {page} of {totalPages}</span>
          <button className={`rounded-xl border border-white/10 px-3 py-2 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 ${compact ? "w-full text-xs" : ""}`} disabled={page >= totalPages} onClick={() => navigate(page + 1)} type="button">Next</button>
        </div>
      </div>
    </div>
  );
}
