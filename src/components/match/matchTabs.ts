import type { Lineup, Match, MatchStats } from "@/lib/providers/types";

/** Match-center tabs (pure: no React, so the default-tab rules are unit-tested). */
export type TabId = "summary" | "live" | "lineups" | "stats" | "highlights" | "h2h" | "table" | "odds";

export const TABS: { id: TabId; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "live", label: "Live" },
  { id: "lineups", label: "Lineups" },
  { id: "stats", label: "Stats" },
  { id: "highlights", label: "Highlights" },
  { id: "h2h", label: "Head-to-head" },
  { id: "table", label: "Table" },
  { id: "odds", label: "Odds" },
];

/** A `?tab=` value from the URL, or null when it isn't one of ours. */
export function parseTab(value: string | null | undefined): TabId | null {
  return TABS.some((t) => t.id === value) ? (value as TabId) : null;
}

/** True when at least one side has a real number (not just ids). */
export function hasStats(stats: MatchStats[]): boolean {
  return stats.some((s) =>
    Object.entries(s).some(([k, v]) => k !== "matchId" && k !== "teamId" && typeof v === "number"),
  );
}

/** True once a starting XI has been posted for either side. */
export function hasLineups(lineups: Lineup[]): boolean {
  return lineups.some((l) => l.starters.length > 0);
}

/**
 * The tab a match page opens on (B36): never an empty one if we can help it.
 * In play → Stats once there are any (the Live feed is empty at 0-0), else
 * Summary; scheduled → Lineups only once they're posted, else Head-to-head;
 * anything else → Summary.
 */
export function defaultTab(
  status: Match["status"],
  data: { stats: MatchStats[]; lineups: Lineup[] },
): TabId {
  if (status === "live" || status === "ht") return hasStats(data.stats) ? "stats" : "summary";
  if (status === "scheduled") return hasLineups(data.lineups) ? "lineups" : "h2h";
  return "summary";
}
