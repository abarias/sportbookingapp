"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type NavItem = {
  href: string;
  label: string;
};

type MobileNavMenuProps = {
  navItems: readonly NavItem[];
  adminItems: readonly NavItem[];
  showAdminItems: boolean;
  sessionControls: React.ReactNode;
};

export function MobileNavMenu({ navItems, adminItems, showAdminItems, sessionControls }: MobileNavMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeOnOutsideClick(event: MouseEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative md:hidden">
      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className="space-y-1.5">
          <span className="block h-0.5 w-5 rounded-full bg-current" />
          <span className="block h-0.5 w-5 rounded-full bg-current" />
          <span className="block h-0.5 w-5 rounded-full bg-current" />
        </span>
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 z-50 mt-3 max-h-[calc(100dvh-5.5rem)] w-[min(82vw,22rem)] overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-stone-950 p-4 text-sm text-stone-300 shadow-2xl shadow-black/50"
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest("a, button")) {
              setIsOpen(false);
            }
          }}
        >
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="block rounded-2xl px-3 py-3 hover:bg-white/10 hover:text-white">
                {item.label}
              </Link>
            ))}
          </div>

          {showAdminItems ? (
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="px-3 text-xs uppercase tracking-[0.18em] text-amber-300">Admin</p>
              <div className="mt-2 space-y-1">
                {adminItems.map((item) => (
                  <Link key={item.href} href={item.href} className="block rounded-2xl px-3 py-3 hover:bg-white/10 hover:text-white">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 border-t border-white/10 pt-4">
            {sessionControls}
          </div>
        </div>
      ) : null}
    </div>
  );
}
