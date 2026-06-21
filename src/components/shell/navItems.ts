import type { ComponentType } from "react";
import {
  HomeIcon,
  MatchesIcon,
  TrophyIcon,
  TransferIcon,
  NewsIcon,
  VideoIcon,
} from "@/components/primitives/icons";

export interface NavItem {
  label: string;
  href: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
}

/**
 * Primary navigation — only routes that exist. "Competitions" links straight to
 * the World Cup table (not /competition/world-cup, which redirects) so clicking
 * it doesn't blank the screen during the redirect hop.
 */
export const NAV: NavItem[] = [
  { label: "Home", href: "/", Icon: HomeIcon },
  { label: "Matches", href: "/matches", Icon: MatchesIcon },
  { label: "Competitions", href: "/competition/world-cup/table", Icon: TrophyIcon },
  { label: "Feed", href: "/feed", Icon: VideoIcon },
  { label: "Transfers", href: "/news?tag=transfers", Icon: TransferIcon },
  { label: "News", href: "/news", Icon: NewsIcon },
];

/** Active-state logic shared by the sidebar and the mobile drawer. */
export function isNavActive(href: string, pathname: string, isTransfers: boolean): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/news") return pathname.startsWith("/news") && !isTransfers;
  if (href === "/news?tag=transfers") return pathname.startsWith("/news") && isTransfers;
  if (href.startsWith("/competition")) return pathname.startsWith("/competition");
  return pathname.startsWith(href.split("?")[0]);
}
