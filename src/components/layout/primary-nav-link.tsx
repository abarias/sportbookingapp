"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PrimaryNavLink({ href, label, showBadge = false }: { href: string; label: string; showBadge?: boolean }) {
  const pathname = usePathname();
  const badgeVisible = showBadge && pathname !== "/account";
  return <Link href={href} className="relative hover:text-white">{label}{badgeVisible ? <span aria-label="New account update" className="absolute -right-2 -top-1 h-2.5 w-2.5 rounded-full bg-amber-300 ring-2 ring-stone-950" /> : null}</Link>;
}
