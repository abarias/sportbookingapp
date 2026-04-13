import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 text-sm text-white outline-none ring-0 placeholder:text-stone-500 focus:border-amber-300",
        className
      )}
      {...props}
    />
  );
}
