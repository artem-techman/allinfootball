"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Logo } from "@/components/primitives/Logo";
import { ThemeToggle } from "./ThemeToggle";
import { NAV, isNavActive } from "./navItems";
import { STOCK_IMAGES } from "@/lib/preview/homePreview";
import { BellIcon, PanelLeftIcon } from "@/components/primitives/icons";

/**
 * Left sidebar (dark reference) — COLLAPSIBLE. The collapsed state persists in
 * localStorage AND in a module-level cache. AppShell is rendered per page, so the
 * Sidebar re-mounts on every navigation; without the cache it would briefly start
 * expanded (initial state) and then collapse from the effect, causing an
 * open/close flash. The cache makes the very first render already collapsed on
 * subsequent navigations — no flash. The one-time animated collapse only happens
 * on a full page load.
 */

const STORAGE_KEY = "allinfootball.sidebar.collapsed";
// Persists across the per-navigation re-mounts within a session.
let cachedCollapsed: boolean | null = null;

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isTransfers = searchParams.get("tag") === "transfers";
  // SSR + first client render use `false` (or the cached value on later mounts) so
  // there is never a hydration mismatch.
  const [collapsed, setCollapsed] = useState<boolean>(cachedCollapsed ?? false);

  useEffect(() => {
    if (cachedCollapsed === null) {
      cachedCollapsed = window.localStorage.getItem(STORAGE_KEY) === "1";
    }
    setCollapsed(cachedCollapsed);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      cachedCollapsed = next;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function enableNotifications() {
    if (typeof window !== "undefined" && "Notification" in window) {
      void Notification.requestPermission().catch(() => {});
    }
  }

  return (
    <aside
      data-collapsed={collapsed}
      className={`flex h-full flex-col border-r border-hairline bg-page py-5 transition-[width] duration-200 ease-out ${
        collapsed ? "w-[76px] px-3" : "w-sidebar px-4"
      }`}
    >
      <div className={`flex items-center ${collapsed ? "flex-col gap-3" : "justify-between px-2"}`}>
        <Logo compact={collapsed} />
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          title={collapsed ? "Expand" : "Collapse"}
          className="grid h-8 w-8 place-items-center rounded-tile text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
        >
          <PanelLeftIcon size={17} />
        </button>
      </div>

      <nav className="mt-7 flex flex-col gap-1">
        {NAV.map(({ label, href, Icon }) => {
          const active = isNavActive(href, pathname, isTransfers);
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? label : undefined}
              className={`group flex items-center rounded-tile text-body font-medium transition-colors duration-200 ${
                collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
              } ${
                active
                  ? "bg-accent-gradient text-text-on-accent"
                  : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
              }`}
            >
              <Icon size={18} />
              {!collapsed && <span className="flex-1">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4">
        <div className={`mb-2 ${collapsed ? "flex justify-center" : ""}`}>
          <ThemeToggle collapsed={collapsed} />
        </div>
        {!collapsed && (
          <div className="relative overflow-hidden rounded-lg2 border border-hairline bg-card">
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-20 opacity-25"
              style={{
                background: `bottom/cover no-repeat url(${STOCK_IMAGES.promo})`,
                maskImage: "linear-gradient(to top, black, transparent)",
                WebkitMaskImage: "linear-gradient(to top, black, transparent)",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-8 -right-6 h-28 w-28 rounded-full bg-accent-lime-soft blur-2xl"
            />
            <div className="relative p-4">
              <p className="text-meta font-semibold text-text-primary">Never miss a moment.</p>
              <p className="mt-1 text-[11px] leading-snug text-text-secondary">
                Turn on notifications and get the biggest football updates instantly.
              </p>
              <button
                type="button"
                onClick={enableNotifications}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-tile bg-accent-gradient py-2 text-[12px] font-semibold text-text-on-accent transition-opacity hover:opacity-90"
              >
                Enable Notifications
                <BellIcon size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
