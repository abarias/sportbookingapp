import Link from "next/link";

type AdminNavProps = {
  current: "overview" | "calendar" | "walk-ins" | "facilities" | "customers" | "reports";
};

const items = [
  { key: "overview", href: "/admin", label: "Overview" },
  { key: "calendar", href: "/admin/calendar", label: "Calendar" },
  { key: "walk-ins", href: "/admin/walk-ins", label: "Walk-ins" },
  { key: "facilities", href: "/admin/facilities", label: "Facilities" },
  { key: "customers", href: "/admin/customers", label: "Customers" },
  { key: "reports", href: "/admin/reports", label: "Reports" }
] as const;

export function AdminNav({ current }: AdminNavProps) {
  return (
    <nav className="flex flex-wrap gap-3">
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
