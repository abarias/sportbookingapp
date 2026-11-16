"use client";

import { useEffect, useRef, useState } from "react";

const PAYMENT_METHODS = [
  { value: "manual_gcash", label: "GCash transfer" },
  { value: "manual_bank_transfer", label: "Bank transfer" }
] as const;

export function PaymentMethodMenu({ name, value, onChange }: { name: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedMethod = PAYMENT_METHODS.find((method) => method.value === value) ?? PAYMENT_METHODS[0];

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <input name={name} type="hidden" value={value} />
      <button aria-expanded={open} aria-haspopup="listbox" className="flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-left text-white outline-none transition hover:border-white/25 focus:border-amber-300" onClick={() => setOpen((current) => !current)} type="button">
        <span>{selectedMethod.label}</span><span aria-hidden="true" className="text-stone-500">▾</span>
      </button>
      {open ? <div aria-label="Payment method" className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-full rounded-xl border border-white/10 bg-stone-900 p-1 shadow-2xl" role="listbox">
        {PAYMENT_METHODS.map((method) => <button aria-selected={value === method.value} className={`block w-full rounded-lg px-3 py-3 text-left text-sm transition hover:bg-white/10 ${value === method.value ? "bg-amber-400/15 text-amber-100" : "text-stone-300"}`} key={method.value} onClick={() => { onChange(method.value); setOpen(false); }} role="option" type="button">{method.label}</button>)}
      </div> : null}
    </div>
  );
}
