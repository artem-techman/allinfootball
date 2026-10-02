import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { TeamProfileView } from "@/components/team/TeamProfileView";
import { JsonLd, sportsTeam, breadcrumb, competitionTableCrumb } from "@/components/seo/JsonLd";
import { buildMetadata } from "@/lib/seo/metadata";
import { provider } from "@/lib/providers";
import { entitySlug, idFromSlug } from "@/lib/utils/slug";
import { getCompetitionByLeagueId, isInScope } from "@/lib/constants/competitions";
import { currentSeasonYear } from "@/lib/season";
import type { Match, Player, Standing } from "@/lib/providers/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const id = idFromSlug(slug);
  const profile = id ? await provider.getTeam(id).catch(() => undefined) : undefined;
  if (!profile || !id) return { title: "Team" };
  return buildMetadata({
    title: profile.team.name,
    description: `${profile.team.name}: fixtures, results, squad and league table on My Football Tracker.`,
    path: `/team/${entitySlug(profile.team.name, id)}`,
  });
}

/** Pick the team's most-played in-scope competition for the Table tab. */
function inferLeague(fixtures: Match[]): number | undefined {
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

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = idFromSlug(slug);
  if (!id) notFound();

  const profile = await provider.getTeam(id).catch(() => undefined);
  if (!profile) notFound();
  // The slug name is decorative — the id resolves the team. If the name doesn't
  // match the real team, send the user to the canonical URL (no stale/mismatched
  // slugs, no duplicate-content indexing).
  const canonical = entitySlug(profile.team.name, id);
  if (canonical !== slug) permanentRedirect(`/team/${canonical}`);

  const [squad, recent, upcoming] = await Promise.all([
    provider.getSquad(id).catch(() => [] as Player[]),
    provider.getTeamFixtures(id, { last: 8 }).catch(() => [] as Match[]),
    provider.getTeamFixtures(id, { next: 8 }).catch(() => [] as Match[]),
  ]);

  const leagueId = inferLeague([...recent, ...upcoming]);
  const comp = leagueId ? getCompetitionByLeagueId(leagueId) : undefined;
  const standings = comp
    ? await currentSeasonYear(comp)
        .then((season) => provider.getStandings(comp.leagueId, season))
        .catch(() => [] as Standing[])
    : [];

  return (
    <AppShell wide>
      <JsonLd data={sportsTeam(profile, slug)} />
      <JsonLd
        data={breadcrumb([
          // No /teams index exists (it 404s): the team's competition is the parent.
          ...(comp ? competitionTableCrumb(comp) : []),
          { name: profile.team.name, path: `/team/${slug}` },
        ])}
      />
      <TeamProfileView profile={profile} recent={recent} upcoming={upcoming} squad={squad} standings={standings} />
    </AppShell>
  );
}
