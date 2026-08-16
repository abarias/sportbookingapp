"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type NavItem = {
  href: string;
  label: string;
};

type DesktopAdminMenuProps = {
  items: readonly NavItem[];
};

export function DesktopAdminMenu({ items }: DesktopAdminMenuProps) {
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
    <div ref={menuRef} className="relative">
      <button
        aria-expanded={isOpen}
        className="cursor-pointer rounded-full px-3 py-2 hover:bg-white/10 hover:text-white"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        Admin
      </button>
      {isOpen ? (
        <div className="absolute right-0 mt-3 w-56 rounded-2xl border border-white/10 bg-stone-950 p-2 shadow-2xl shadow-black/40">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-xl px-3 py-2 text-sm text-stone-300 hover:bg-white/10 hover:text-white"
              onClick={() => setIsOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
