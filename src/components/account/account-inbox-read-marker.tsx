"use client";

import { useEffect } from "react";

export function AccountInboxReadMarker() {
  useEffect(() => {
    void fetch("/api/account/inbox/read", { method: "POST" });
  }, []);
  return null;
}
