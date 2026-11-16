import type { Metadata } from "next";

import "@/app/globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { getSiteTitle, siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: getSiteTitle(),
  description: siteConfig.description,
  icons: {
    icon: "/MMG_STELLAR_favicon.png",
    apple: "/MMG_STELLAR_favicon.png"
  }
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="overflow-x-clip bg-stone-950 text-stone-50 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
