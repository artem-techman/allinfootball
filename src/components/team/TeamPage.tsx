import { notFound, permanentRedirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { TeamProfileView } from "@/components/team/TeamProfileView";
import { JsonLd, sportsTeam, breadcrumb, competitionTableCrumb } from "@/components/seo/JsonLd";
import { provider } from "@/lib/providers";
import { currentSeasonYear } from "@/lib/season";
import { loadTeam, teamPath, type TeamTab } from "@/lib/seo/team";
import type { Player, Standing } from "@/lib/providers/types";

const CRUMB: Record<TeamTab, string> = { overview: "", fixtures: "Fixtures", results: "Results", squad: "Squad", table: "Table" };

/** Every team URL (/team/x, /team/x/fixtures, …) renders this with its own tab. */
export async function TeamPage({ slug, tab }: { slug: string; tab: TeamTab }) {
  const data = await loadTeam(slug);
  if (!data) notFound();
  const { id, profile, recent, upcoming, comp, canonical } = data;
  // The slug name is decorative — the id resolves the team. Mismatched names
  // redirect to the canonical URL (no duplicate-content indexing).
  if (canonical !== slug) permanentRedirect(teamPath(canonical, tab));

  const [squad, standings] = await Promise.all([
    tab === "overview" || tab === "squad" ? provider.getSquad(id).catch(() => [] as Player[]) : Promise.resolve([] as Player[]),
    comp && (tab === "overview" || tab === "table")
      ? currentSeasonYear(comp)
          .then((season) => provider.getStandings(comp.leagueId, season))
          .catch(() => [] as Standing[])
      : Promise.resolve([] as Standing[]),
  ]);

  return (
    <AppShell wide>
      <JsonLd data={sportsTeam(profile, canonical)} />
      <JsonLd
        data={breadcrumb([
          // No /teams index exists (it 404s): the team's competition is the parent.
          ...(comp ? competitionTableCrumb(comp) : []),
          { name: profile.team.name, path: `/team/${canonical}` },
          ...(tab === "overview" ? [] : [{ name: `${profile.team.name} ${CRUMB[tab].toLowerCase()}`, path: teamPath(canonical, tab) }]),
        ])}
      />
      <TeamProfileView profile={profile} slug={canonical} tab={tab} recent={recent} upcoming={upcoming} squad={squad} standings={standings} />
    </AppShell>
  );
}
