"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

export function AdminSessionGuard({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!enabled) return;

    let signingOut = false;

    async function verifyAccess() {
      const response = await fetch("/api/auth/admin-status", { cache: "no-store" });
      if (!response.ok) return;
      const result = await response.json() as { active?: boolean };
      if (!result.active && !signingOut) {
        signingOut = true;
        await signOut({ redirectTo: "/login?callbackUrl=%2Fadmin&reason=session-expired" });
      }
    }

    void verifyAccess();
    const handleFocus = () => void verifyAccess();
    const intervalId = window.setInterval(() => void verifyAccess(), 10000);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [enabled, pathname]);

  return null;
}
