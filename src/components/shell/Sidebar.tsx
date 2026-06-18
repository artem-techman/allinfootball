"use client";

import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Logo } from "@/components/primitives/Logo";
import { ThemeToggle } from "./ThemeToggle";
import { STOCK_IMAGES } from "@/lib/preview/homePreview";
import {
  HomeIcon,
  MatchesIcon,
  TrophyIcon,
  TransferIcon,
  NewsIcon,
  BellIcon,
  PanelLeftIcon,
} from "@/components/primitives/icons";

/**
 * Left sidebar (dark reference) — COLLAPSIBLE. Expanded: 248px panel with the
 * All In Football logo, labelled nav, a theme toggle and a promo card. Collapsed:
 * ~76px icon rail with the mark and icon-only nav (tooltips). The collapsed state
 * persists in localStorage; the layout adapts because AppShell's main is flex-1.
 *
 * Nav only links to routes that exist and are reachable — individual team and
 * player pages are reached from tables/scorers, not a top-level index.
 */

const STORAGE_KEY = "allinfootball.sidebar.collapsed";

interface NavItem {
  label: string;
  href: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
}

const NAV: NavItem[] = [
  { label: "Home", href: "/", Icon: HomeIcon },
  { label: "Matches", href: "/matches", Icon: MatchesIcon },
  { label: "Competitions", href: "/competition/premier-league", Icon: TrophyIcon },
  { label: "Transfers", href: "/news?tag=transfers", Icon: TransferIcon },
  { label: "News", href: "/news", Icon: NewsIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isTransfers = searchParams.get("tag") === "transfers";
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed, mounted]);

  const toggle = () => setCollapsed((c) => !c);

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
      {/* logo + collapse toggle */}
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
          // News and Transfers both live under /news — disambiguate via ?tag.
          const active =
            href === "/"
              ? pathname === "/"
              : href === "/news"
                ? pathname.startsWith("/news") && !isTransfers
                : href === "/news?tag=transfers"
                  ? pathname.startsWith("/news") && isTransfers
                  : pathname.startsWith(href.split("?")[0]);
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
                  ? "bg-accent-lime text-text-on-accent"
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
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-tile bg-accent-lime py-2 text-[12px] font-semibold text-text-on-accent transition-colors hover:bg-accent-lime-dim"
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
