"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Logo } from "@/components/primitives/Logo";
import { ThemeToggle } from "./ThemeToggle";
import { NAV, isNavActive } from "./navItems";
import { MenuIcon, CloseIcon } from "@/components/primitives/icons";

/**
 * Mobile navigation (#3): the top-bar hamburger opens a slide-in drawer with the
 * primary nav, since the desktop sidebar is hidden below 820px. Closes on
 * backdrop click, the close button, Escape, or navigating.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isTransfers = searchParams.get("tag") === "transfers";

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="grid h-9 w-9 place-items-center rounded-tile border border-hairline text-text-secondary"
      >
        <MenuIcon size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 min-[821px]:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute inset-0 flex w-full flex-col bg-page px-4 py-5">
            <div className="flex items-center justify-between px-2">
              <Logo />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid h-8 w-8 place-items-center rounded-tile text-text-muted hover:bg-white/5 hover:text-text-primary"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <nav className="mt-7 flex flex-col gap-1">
              {NAV.map(({ label, href, Icon }) => {
                const active = isNavActive(href, pathname, isTransfers);
                return (
                  <Link
                    key={label}
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-tile px-3 py-2.5 text-body font-medium ${
                      active
                        ? "bg-accent-lime text-text-on-accent"
                        : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
                    }`}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto">
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
