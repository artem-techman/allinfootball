"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Logo } from "@/components/primitives/Logo";
import { FanPulseCard } from "./FanPulseCard";
import { NAV, isNavActive } from "./navItems";
import { PanelLeftIcon } from "@/components/primitives/icons";

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

  // Mirror the collapsed state onto <html> so layout elsewhere (e.g. the home
  // Top Stories grid) can respond to it via the `sidebar-collapsed` variant.
  useEffect(() => {
    document.documentElement.setAttribute("data-sidebar", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);

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
        {/* Fan Pulse micro-poll — shown only when the sidebar is expanded. */}
        {!collapsed && <FanPulseCard />}
      </div>
    </aside>
  );
}
