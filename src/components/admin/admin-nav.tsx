import Link from "next/link";

import { getCurrentAdminAuthorization } from "@/lib/auth/authorization";
import { visibleAdminNavigation, type AdminNavigationKey } from "@/lib/auth/admin-navigation";

type AdminNavProps = {
  current: AdminNavigationKey;
};

export async function AdminNav({ current }: AdminNavProps) {
  const authorization = await getCurrentAdminAuthorization();
  const items = authorization ? visibleAdminNavigation(authorization.permissions) : [];
  return (
    <nav className="hidden flex-wrap gap-3 md:flex">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={`rounded-full px-4 py-2 text-sm transition ${
            item.key === current ? "bg-amber-400 text-stone-950" : "bg-white/10 text-white hover:bg-white/15"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
