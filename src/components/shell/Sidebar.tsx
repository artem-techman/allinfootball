"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Logo } from "@/components/primitives/Logo";
import { ThemeToggle } from "./ThemeToggle";
import { NAV, isNavActive } from "./navItems";
import { PanelLeftIcon } from "@/components/primitives/icons";

// Where ad enquiries go. Change this to your real ad-sales inbox / media-kit URL.
const AD_CONTACT = "mailto:ads@myfootballtracker.com?subject=Advertising%20on%20My%20Football%20Tracker";
const AD_MEDIA_KIT = "mailto:ads@myfootballtracker.com?subject=Media%20kit%20request%20%E2%80%94%20My%20Football%20Tracker";

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
        <div className={`mb-2 ${collapsed ? "flex justify-center" : ""}`}>
          <ThemeToggle collapsed={collapsed} />
        </div>
        {collapsed ? (
          // Collapsed: keep the ad slot present as a single branded button.
          <a
            href={AD_CONTACT}
            title="Advertise with us"
            aria-label="Advertise with us"
            className="mx-auto grid h-10 w-10 place-items-center rounded-tile bg-accent-gradient text-text-on-accent shadow-soft transition-opacity hover:opacity-90"
          >
            <MegaphoneIcon size={18} />
          </a>
        ) : (
          // Expanded: the self-promoting ad-sales widget.
          <div className="relative overflow-hidden rounded-lg2 border border-hairline bg-card shadow-soft">
            {/* gradient top accent + corner glow to draw the eye */}
            <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-accent-gradient" />
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-accent-gradient opacity-25 blur-2xl"
            />
            <div className="relative p-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-lime-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-accent-lime">
                <MegaphoneIcon size={12} /> Advertise
              </span>
              <p className="mt-2.5 text-cardtitle font-bold leading-tight text-text-primary">Place your ad here</p>
              <p className="mt-1 text-[11px] leading-snug text-text-secondary">
                Reach thousands of football fans every day — put your brand front and centre.
              </p>
              <a
                href={AD_CONTACT}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-tile bg-accent-gradient py-2 text-[12px] font-semibold text-text-on-accent transition-opacity hover:opacity-90"
              >
                Contact us
              </a>
              <a
                href={AD_MEDIA_KIT}
                className="mt-2 flex w-full items-center justify-center gap-1 text-[11px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
              >
                View media kit <span aria-hidden>→</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function MegaphoneIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}
