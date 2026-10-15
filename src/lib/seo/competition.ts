import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCompetitionBySlug, type CompetitionConst } from "@/lib/constants/competitions";
import { seasonYearFor } from "@/lib/season";
import { buildMetadata } from "./metadata";

/** "2026/27" for split-year competitions, "2026" for MLS / World Cup. */
export function seasonLabel(comp: CompetitionConst): string {
  const y = seasonYearFor(comp);
  return comp.country === "USA" || comp.slug === "world-cup" ? String(y) : `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
}

export type CompetitionTab = "fixtures" | "table" | "scorers" | "news";

const COPY: Record<CompetitionTab, { title: (n: string, season: string) => string; description: (n: string, season: string) => string }> = {
  fixtures: {
    title: (n, season) => `${n} fixtures ${season}: dates, kick-off times & results`,
    description: (n, season) =>
      `Every ${n} fixture for ${season}: upcoming matches with UK kick-off times, live scores on matchdays and full results, round by round.`,
  },
  table: {
    title: (n, season) => `${n} table ${season}: standings, points & form`,
    description: (n, season) =>
      `The ${n} table for ${season}, updated live: positions, points, goal difference and each team's form over their last five matches.`,
  },
  scorers: {
    title: (n, season) => `${n} top scorers ${season}: goals & assists`,
    description: (n, season) =>
      `${n} top scorers for ${season}: the Golden Boot race, leading goalscorers and assist providers, updated after every match.`,
  },
  news: {
    title: (n) => `${n} news: latest headlines`,
    description: (n) =>
      `The latest ${n} news from trusted football sources: transfers, team news, results and reaction, each linked to the original publisher.`,
  },
};

/** Metadata for /competition/[slug]/[tab]. Unknown slugs 404 in the page. */
export function competitionTabMetadata(slug: string, tab: CompetitionTab): Metadata {
  const comp = getCompetitionBySlug(slug);
  if (!comp) notFound(); // real 404 (metadata is blocking), not a soft 200
  const copy = COPY[tab];
  const season = seasonLabel(comp);
  return buildMetadata({
    title: copy.title(comp.name, season),
    description: copy.description(comp.name, season),
    path: `/competition/${comp.slug}/${tab}`,
  });
}
