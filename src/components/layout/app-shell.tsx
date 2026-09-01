import Link from "next/link";
import Image from "next/image";

import { auth } from "@/auth";
import { DesktopAdminMenu } from "@/components/layout/desktop-admin-menu";
import { MobileNavMenu } from "@/components/layout/mobile-nav-menu";
import { SessionNav } from "@/components/layout/session-nav";
import { AdminSessionGuard } from "@/components/layout/admin-session-guard";
import { getCurrentAdminAuthorization } from "@/lib/auth/authorization";
import { visibleAdminNavigation } from "@/lib/auth/admin-navigation";
import { getActiveCartCount } from "@/server/cart/service";
import { getCustomerAccountNotificationState } from "@/server/account/queries";
import { PrimaryNavLink } from "@/components/layout/primary-nav-link";

type AppShellProps = Readonly<{
  children: React.ReactNode;
}>;

export async function AppShell({ children }: AppShellProps) {
  const session = await auth();
  const authorization = session?.user ? await getCurrentAdminAuthorization() : null;
  const cartCount = session?.user?.role === "CUSTOMER" ? await getActiveCartCount(session.user.id) : 0;
  const hasAccountNotifications = session?.user?.role === "CUSTOMER" ? await getCustomerAccountNotificationState(session.user.id) : false;
  const canOpenAccount = session?.user?.role === "CUSTOMER" || Boolean(authorization);
  const navItems = [
    { href: "/facilities", label: "Facilities" },
    ...(session?.user?.role === "CUSTOMER" ? [{ href: "/cart", label: `Cart (${cartCount})` }] : []),
    { href: "/bookings", label: "My Bookings" },
    ...(canOpenAccount ? [{ href: "/account", label: "My Account", showBadge: session?.user?.role === "CUSTOMER" && hasAccountNotifications }] : [])
  ];
  const adminItems = authorization ? visibleAdminNavigation(authorization.permissions) : [];
  const showAdminItems = adminItems.length > 0;
  const displaySession = session?.user?.role === "ADMIN" && !authorization ? null : session;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-stone-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="MMG Stellar home" className="shrink-0">
            <Image
              src="/MMG_STELLAR_logo.png"
              alt="MMG Stellar"
              width={144}
              height={80}
              priority
              className="h-11 w-auto object-contain sm:h-12"
            />
          </Link>
          <nav className="hidden items-center gap-4 text-sm text-stone-300 md:flex">
            {navItems.map((item) => (
              <PrimaryNavLink key={item.href} href={item.href} label={item.label} showBadge={item.showBadge} />
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
