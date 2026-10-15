import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { MatchCenter, type MatchBundle } from "@/components/match/MatchCenter";
import { MatchStory } from "@/components/match/MatchStory";
import { TeamNews } from "@/components/match/TeamNews";
import { readLastGood } from "@/lib/db/lastGood";
import { seoMatchDescription, seoMatchTitle } from "@/lib/seo/matchCopy";
import { JsonLd, sportsEvent, breadcrumb, competitionTableCrumb } from "@/components/seo/JsonLd";
import { provider } from "@/lib/providers";
import { highlights } from "@/lib/highlights";
import { archiveFinishedMatch, readArchivedMatch } from "@/lib/db/matchStore";
import { entitySlug, idFromSlug } from "@/lib/utils/slug";
import { buildMetadata } from "@/lib/seo/metadata";
import { canonicalMatchSlug } from "@/lib/seo/matchShare";
import type { Injury, Lineup, Match, MatchEvent, MatchStats, Odds, Standing } from "@/lib/providers/types";

export const dynamic = "force-dynamic";

/**
 * Archive-first match lookup: finished matches are immutable and served from
 * our own Supabase archive with zero provider API calls; anything not archived
 * falls through to the provider. readArchivedMatch is react-cached, so
 * generateMetadata and the page body share one DB round-trip.
 */
async function loadMatch(id: number): Promise<Match | undefined> {
  const archived = await readArchivedMatch(id);
  if (archived) return archived.match;
  return provider.getMatch(id).catch(() => undefined);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const id = idFromSlug(slug);
  const match = id ? await loadMatch(id) : undefined;
  // notFound() here (metadata is blocking — htmlLimitedBots) gives unknown ids a
  // real 404 status instead of a 200 "soft 404".
  if (!match) notFound();
  return buildMetadata({
    title: seoMatchTitle(match),
    absoluteTitle: true,
    description: seoMatchDescription(match),
    path: `/match/${canonicalMatchSlug(match, slug)}`,
    // og:image comes from ./opengraph-image.tsx (per-match score card).
    image: "file",
  });
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const id = idFromSlug(slug);
  if (!id) notFound();

  const archived = await readArchivedMatch(id);
  const match = archived?.match ?? (await provider.getMatch(id).catch(() => undefined));
  if (!match) notFound();
  // Redirect decorative/stale slugs to the canonical one. Guard on both team
  // names so a partial fixture never builds a malformed slug (redirect loop).
  if (match.homeTeam?.name && match.awayTeam?.name) {
    const canonical = entitySlug(`${match.homeTeam.name}-${match.awayTeam.name}`, id);
    if (canonical !== slug) permanentRedirect(`/match/${canonical}`);
  }

  const finished = match.status === "finished";

  // Detail bundle: archived finished matches cost zero provider calls; anything
  // else is fetched live. Odds are pre-match only, so they're skipped entirely
  // for finished matches (a guaranteed-useless quota spend otherwise).
  const details =
    archived?.details ??
    (await (async () => {
      const [events, lineups, stats, h2h] = await Promise.all([
        provider.getEvents(id).catch(() => [] as MatchEvent[]),
        provider.getLineups(id).catch(() => [] as Lineup[]),
        provider.getStatistics(id).catch(() => [] as MatchStats[]),
        provider.getHeadToHead(match.homeTeamId, match.awayTeamId, 5).catch(() => [] as Match[]),
      ]);
      return { events, lineups, stats, h2h };
    })());
  const { events, lineups, stats } = details;
  // Matches archived in bulk (for crawlers) carry no head-to-head: fetch it —
  // from the saved copy for robots, live (cached a day) for fans.
  const h2h =
    details.h2h.length > 0
      ? details.h2h
      : await provider.getHeadToHead(match.homeTeamId, match.awayTeamId, 5).catch(() => [] as Match[]);

  // Injuries & suspensions come only from what the SEO job saved: a page view
  // never requests them (undefined = not reported for this competition yet).
  const upcoming = match.status === "scheduled";
  const [homeForm, awayForm, injuries] = await Promise.all([
    provider.getTeamFixtures(match.homeTeamId, { last: 5 }).catch(() => [] as Match[]),
    provider.getTeamFixtures(match.awayTeamId, { last: 5 }).catch(() => [] as Match[]),
    upcoming ? readLastGood<{ rows: Injury[] }>(`injuries:${id}`).catch(() => undefined) : Promise.resolve(undefined),
  ]);
  const absences = injuries?.rows;
  const [standings, odds, highlight] = await Promise.all([
    provider.getStandings(match.competitionId, match.seasonYear).catch(() => [] as Standing[]),
    finished
      ? Promise.resolve(undefined as Odds | undefined)
      : provider.getOdds(id).catch(() => undefined as Odds | undefined),
    // Post-match highlights only become available once a match has finished.
    finished
      ? highlights
          .getMatchHighlight({
            home: match.homeTeam?.name ?? "",
            away: match.awayTeam?.name ?? "",
            dateIso: match.kickoffUtc,
            competitionSlug: match.competition?.slug,
          })
          .catch(() => undefined)
      : Promise.resolve(undefined),
  ]);

  // First view after the final whistle: persist the immutable bundle so every
  // later view of this match is served from our own DB (best-effort, non-blocking
  // for correctness — a failed write just means the next view archives it).
  if (finished && !archived?.details) {
    await archiveFinishedMatch(match, { events, lineups, stats, h2h }).catch(() => {});
  }

  const bundle: MatchBundle = { match, events, lineups, stats, h2h, standings, odds, highlight };

  return (
    <AppShell>
      <JsonLd data={sportsEvent(match, slug)} />
      <JsonLd
        data={breadcrumb([
          { name: "Matches", path: "/matches" },
          ...(match.competition ? competitionTableCrumb(match.competition) : []),
          { name: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`, path: `/match/${slug}` },
        ])}
      />
      {/* keyed per fixture: client navigation between matches must remount, not
          keep the previous match's state */}
      <MatchCenter
        key={match.id}
        bundle={bundle}
        intro={
          <>
            <MatchStory match={match} events={events} h2h={h2h} table={standings} homeForm={homeForm} awayForm={awayForm} absences={absences} />
            {upcoming && <TeamNews match={match} absences={absences} />}
          </>
        }
      />
    </AppShell>
  );
}
