import "server-only";
import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { provider } from "@/lib/providers";
import { getCompetitionByLeagueId, isInScope, type CompetitionConst } from "@/lib/constants/competitions";
import { entitySlug, idFromSlug } from "@/lib/utils/slug";
import { buildMetadata } from "./metadata";
import { seasonLabel } from "./competition";
import type { Match } from "@/lib/providers/types";

/**
 * Team pages: one URL per search intent. "Arsenal fixtures", "Arsenal results"
 * and "Arsenal squad" are separate searches, so each is its own page with its
 * own title (they were tabs on a single URL). Everything is built from the
 * saved season lists and the saved team profile/squad: robots cost nothing.
 */

export type TeamTab = "overview" | "fixtures" | "results" | "squad" | "table";
export const TEAM_SUBPAGES: Exclude<TeamTab, "overview">[] = ["fixtures", "results", "squad", "table"];

/** The team's most-played in-scope competition (Table tab, season label). */
export function inferLeague(fixtures: Match[]): number | undefined {
  const counts = new Map<number, number>();
  for (const f of fixtures) {
    if (isInScope(f.competitionId)) counts.set(f.competitionId, (counts.get(f.competitionId) ?? 0) + 1);
  }
  let best: number | undefined;
  let max = 0;
  for (const [id, n] of counts) {
    if (n > max) {
      max = n;
      best = id;
    }
  }
  return best;
}

export function teamPath(slug: string, tab: TeamTab): string {
  return tab === "overview" ? `/team/${slug}` : `/team/${slug}/${tab}`;
}

const COPY: Record<TeamTab, { title: (n: string, s: string, comp?: string) => string; description: (n: string, s: string, comp?: string) => string }> = {
  overview: {
    title: (n) => `${n}: next match, latest scores & form`,
    description: (n) => `${n} at a glance: the next fixture with kick-off time, the latest results, recent form and where they sit in the table.`,
  },
  fixtures: {
    title: (n, s) => `${n} fixtures ${s}: upcoming matches & kick-off times`,
    description: (n, s) => `Every upcoming ${n} fixture for ${s}, with dates, UK kick-off times and competitions, plus previews and team news for each match.`,
  },
  results: {
    title: (n, s) => `${n} results ${s}: every score this season`,
    description: (n, s) => `All ${n} results for ${s}: final scores, goalscorers and match reports, newest first.`,
  },
  squad: {
    title: (n, s) => `${n} squad ${s}: players, positions & numbers`,
    description: (n, s) => `The ${n} squad for ${s}: goalkeepers, defenders, midfielders and forwards with shirt numbers, and each player's stats.`,
  },
  table: {
    title: (n, _s, comp) => `${n} league position${comp ? `: ${comp} table` : ""}`,
    description: (n, _s, comp) => `Where ${n} sit in the ${comp ?? "league"} table: points, goal difference and form.`,
  },
};

/** Shared loader: profile + this season's fixtures (from the saved season lists). */
export const loadTeam = cache(async (slug: string) => {
  const id = idFromSlug(slug);
  if (!id) return undefined;
  const profile = await provider.getTeam(id).catch(() => undefined);
  if (!profile) return undefined;
  const [recent, upcoming] = await Promise.all([
    provider.getTeamFixtures(id, { last: 60 }).catch(() => [] as Match[]),
    provider.getTeamFixtures(id, { next: 60 }).catch(() => [] as Match[]),
  ]);
  const leagueId = inferLeague([...recent, ...upcoming]);
  const comp: CompetitionConst | undefined = leagueId ? getCompetitionByLeagueId(leagueId) : undefined;
  return { id, profile, recent, upcoming, comp, canonical: entitySlug(profile.team.name, id) };
});

export async function teamMetadata(slug: string, tab: TeamTab): Promise<Metadata> {
  const data = await loadTeam(slug);
  if (!data) notFound(); // real 404 status (metadata is blocking)
  const name = data.profile.team.name;
  const season = data.comp ? seasonLabel(data.comp) : "";
  const copy = COPY[tab];
  return buildMetadata({
    title: copy.title(name, season, data.comp?.name).replace(/\s+:/, ":").trim(),
    description: copy.description(name, season || "this season", data.comp?.name),
    path: teamPath(data.canonical, tab),
    // The league table already has its own page: this one shouldn't compete with it.
    ...(tab === "table" ? { robots: { index: false, follow: true } } : {}),
  });
}
