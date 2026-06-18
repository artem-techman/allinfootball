import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { MatchCenter, type MatchBundle } from "@/components/match/MatchCenter";
import { JsonLd, sportsEvent, breadcrumb } from "@/components/seo/JsonLd";
import { provider } from "@/lib/providers";
import { idFromSlug } from "@/lib/utils/slug";
import type { Lineup, Match, MatchEvent, MatchStats, Odds, Standing } from "@/lib/providers/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const id = idFromSlug(slug);
  const match = id ? await provider.getMatch(id).catch(() => undefined) : undefined;
  if (!match) return { title: "Match" };
  const title = `${match.homeTeam?.name} vs ${match.awayTeam?.name}`;
  return {
    title,
    description: `${title} — live score, lineups, stats and head-to-head in the ${match.competition?.name}.`,
    alternates: { canonical: `/match/${slug}` },
  };
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const id = idFromSlug(slug);
  if (!id) notFound();

  const match = await provider.getMatch(id).catch(() => undefined);
  if (!match) notFound();

  const [events, lineups, stats, h2h, standings, odds] = await Promise.all([
    provider.getEvents(id).catch(() => [] as MatchEvent[]),
    provider.getLineups(id).catch(() => [] as Lineup[]),
    provider.getStatistics(id).catch(() => [] as MatchStats[]),
    provider.getHeadToHead(match.homeTeamId, match.awayTeamId, 5).catch(() => [] as Match[]),
    provider.getStandings(match.competitionId, match.seasonYear).catch(() => [] as Standing[]),
    provider.getOdds(id).catch(() => undefined as Odds | undefined),
  ]);

  const bundle: MatchBundle = { match, events, lineups, stats, h2h, standings, odds };

  return (
    <AppShell>
      <JsonLd data={sportsEvent(match, slug)} />
      <JsonLd
        data={breadcrumb([
          { name: "Matches", path: "/matches" },
          ...(match.competition ? [{ name: match.competition.name, path: `/competition/${match.competition.slug}` }] : []),
          { name: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`, path: `/match/${slug}` },
        ])}
      />
      <MatchCenter bundle={bundle} />
    </AppShell>
  );
}
