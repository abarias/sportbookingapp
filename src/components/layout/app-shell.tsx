import Link from "next/link";

import { auth } from "@/auth";
import { DesktopAdminMenu } from "@/components/layout/desktop-admin-menu";
import { MobileNavMenu } from "@/components/layout/mobile-nav-menu";
import { SessionNav } from "@/components/layout/session-nav";
import { AdminSessionGuard } from "@/components/layout/admin-session-guard";
import { siteConfig } from "@/lib/config/site";
import { getCurrentAdminAuthorization } from "@/lib/auth/authorization";
import { visibleAdminNavigation } from "@/lib/auth/admin-navigation";
import { getActiveCartCount } from "@/server/cart/service";

type AppShellProps = Readonly<{
  children: React.ReactNode;
}>;

export async function AppShell({ children }: AppShellProps) {
  const session = await auth();
  const authorization = session?.user ? await getCurrentAdminAuthorization() : null;
  const cartCount = session?.user?.role === "CUSTOMER" ? await getActiveCartCount(session.user.id) : 0;
  const navItems = [
    { href: "/facilities", label: "Facilities" },
    ...(session?.user?.role === "CUSTOMER" ? [{ href: "/cart", label: `Cart (${cartCount})` }] : []),
    { href: "/bookings", label: "My Bookings" }
  ];
  const adminItems = authorization ? visibleAdminNavigation(authorization.permissions) : [];
  const showAdminItems = adminItems.length > 0;
  const displaySession = session?.user?.role === "ADMIN" && !authorization ? null : session;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-stone-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-lg font-semibold tracking-tight text-white">
            {siteConfig.name}
          </Link>
          <nav className="hidden items-center gap-4 text-sm text-stone-300 md:flex">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-white">
                {item.label}
              </Link>
            ))}
            {showAdminItems ? (
              <DesktopAdminMenu items={adminItems} />
            ) : null}
            <SessionNav session={displaySession} />
          </nav>
          <MobileNavMenu
            adminItems={adminItems}
            navItems={navItems}
            sessionControls={<SessionNav session={displaySession} />}
            showAdminItems={showAdminItems}
          />
        </div>
      </header>
      <AdminSessionGuard enabled={session?.user?.role === "ADMIN"} />
      <div className="mx-auto min-w-0 max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}
