import Link from "next/link";

import { auth } from "@/auth";
import { SessionNav } from "@/components/layout/session-nav";
import { siteConfig } from "@/lib/config/site";

type AppShellProps = Readonly<{
  children: React.ReactNode;
}>;

const navItems = [
  { href: "/facilities", label: "Facilities" },
  { href: "/bookings", label: "My Bookings" }
] as const;

export async function AppShell({ children }: AppShellProps) {
  const session = await auth();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-stone-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-lg font-semibold tracking-tight text-white">
            {siteConfig.name}
          </Link>
          <nav className="flex items-center gap-4 text-sm text-stone-300">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-white">
                {item.label}
              </Link>
            ))}
            <SessionNav session={session} />
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}
