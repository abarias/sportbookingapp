"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function formatRemaining(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function PaymentHoldCountdown({ expiresAt, deadlineLabel, initialRemainingMs }: { expiresAt: string; deadlineLabel: string; initialRemainingMs: number }) {
  const router = useRouter();
  const [remainingMs, setRemainingMs] = useState(initialRemainingMs);

  useEffect(() => {
    let refreshed = false;
    const update = () => {
      const nextRemainingMs = new Date(expiresAt).getTime() - Date.now();
      setRemainingMs(nextRemainingMs);

      if (nextRemainingMs <= 0 && !refreshed) {
        refreshed = true;
        router.refresh();
      }
    };

    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt, router]);

  return (
    <p className="rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm font-medium leading-6 text-amber-100">
      Reserved for you for {remainingMs > 0 ? formatRemaining(remainingMs) : "0m 00s"}. Submit proof before {deadlineLabel}.
    </p>
  );
}
