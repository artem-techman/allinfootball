import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompetitionLayout } from "@/components/competition/CompetitionLayout";
import { MatchCard } from "@/components/cards/MatchCard";
import { StandingsTable } from "@/components/tables/StandingsTable";
import { JsonLd } from "@/components/seo/JsonLd";
import { provider } from "@/lib/providers";
import { getCompetitionBySlug } from "@/lib/constants/competitions";
import { currentSeasonYear } from "@/lib/season";
import { readArchivedMatch } from "@/lib/db/matchStore";
import { buildMetadata, SITE_URL } from "@/lib/seo/metadata";
import { seasonLabel } from "@/lib/seo/competition";
import { dateRange, groupRounds, indexableRounds, roundDescription, roundSummary, roundTitle, type Round } from "@/lib/seo/rounds";
import type { Match, MatchEvent, Standing } from "@/lib/providers/types";

export const dynamic = "force-dynamic";

/**
 * One page per round (/competition/premier-league/round/gameweek-8): the fixture
 * list before it, live scores during it, the round-up after it. Built from the
 * saved season list, the match archive and the saved table — robots cost nothing.
 */
async function load(slug: string, roundSlug: string) {
  const comp = getCompetitionBySlug(slug);
  if (!comp) return undefined;
  const season = await currentSeasonYear(comp);
  const matches = await provider.getFixturesByLeague(comp.leagueId, season).catch(() => [] as Match[]);
  const rounds = groupRounds(comp.slug, matches);
  const round = rounds.find((r) => r.slug === roundSlug);
  return round ? { comp, season, rounds, round } : undefined;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; round: string }> }): Promise<Metadata> {
  const { slug, round } = await params;
  const data = await load(slug, round);
  if (!data) notFound();
  const { comp, rounds, round: r } = data;
  const indexable = indexableRounds(rounds).includes(r);
  return buildMetadata({
    title: roundTitle(comp.name, r, seasonLabel(comp)),
    absoluteTitle: true,
    description: roundDescription(comp.name, r),
    path: `/competition/${comp.slug}/round/${r.slug}`,
    // Rounds months away are just a list of dates: keep them out of the index until they're near.
    ...(indexable ? {} : { robots: { index: false, follow: true } }),
  });
}

export default async function RoundPage({ params }: { params: Promise<{ slug: string; round: string }> }) {
  const { slug, round } = await params;
  const data = await load(slug, round);
  if (!data) notFound();
  const { comp, season, rounds, round: r } = data;

  const finished = r.matches.filter((m) => m.status === "finished");
  const [archived, standings] = await Promise.all([
    Promise.all(finished.map((m) => readArchivedMatch(m.id).catch(() => undefined))),
    comp.type === "league" ? provider.getStandings(comp.leagueId, season).catch(() => [] as Standing[]) : Promise.resolve([] as Standing[]),
  ]);
  const events = new Map<number, MatchEvent[]>();
  finished.forEach((m, i) => events.set(m.id, archived[i]?.details?.events ?? []));
  const summary = roundSummary(comp.name, r, events);
  const prev = rounds[r.index - 1];
  const next = rounds[r.index + 1];
  const lc = r.label.charAt(0).toLowerCase() + r.label.slice(1);

  return (
    <CompetitionLayout slug={slug} active="fixtures" title={`${comp.name} ${lc}`} subtitle={`${dateRange(r)} · Season ${seasonLabel(comp)}`}>
      <JsonLd data={itemList(comp.name, r)} />
      <div className="space-y-5">
        <RoundNav compSlug={comp.slug} prev={prev} next={next} />

        {summary.length > 0 && (
          <section className="rounded-card border border-hairline bg-card p-card" aria-labelledby="round-summary">
            <h2 id="round-summary" className="text-cardtitle text-text-primary">
              {r.state === "upcoming" ? `${r.label} preview` : r.state === "complete" ? `${r.label} round-up` : `${r.label} so far`}
            </h2>
            <div className="mt-2 space-y-2 text-body leading-relaxed text-text-secondary">
              {summary.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        )}

        {byDay(r.matches).map(([day, list]) => (
          <section key={day} className="rounded-card border border-hairline bg-card p-card">
            <h2 className="mb-2 border-b border-hairline pb-2 text-cardtitle text-text-primary">{day}</h2>
            <ul className="divide-y divide-hairline">
              {list.map((m) => (
                <li key={m.id}>
                  <MatchCard match={m} />
                </li>
              ))}
            </ul>
          </section>
        ))}

        {standings.length > 0 && (
          <section aria-labelledby="round-table" className="space-y-2">
            <h2 id="round-table" className="text-cardtitle text-text-primary">
              {comp.name} table
            </h2>
            <StandingsTable rows={standings} />
          </section>
        )}

        <RoundNav compSlug={comp.slug} prev={prev} next={next} />
      </div>
    </CompetitionLayout>
  );
}

function RoundNav({ compSlug, prev, next }: { compSlug: string; prev?: Round; next?: Round }) {
  if (!prev && !next) return null;
  const cls = "inline-flex items-center gap-1 rounded-full border border-hairline bg-card px-3 py-1.5 text-meta font-semibold text-text-secondary hover:text-text-primary";
  return (
    <nav className="flex items-center justify-between gap-3" aria-label="Rounds">
      {prev ? <Link href={`/competition/${compSlug}/round/${prev.slug}`} className={cls}>← {prev.label}</Link> : <span />}
      <Link href={`/competition/${compSlug}/fixtures`} className="text-meta font-semibold text-text-secondary hover:text-text-primary">
        All fixtures
      </Link>
      {next ? <Link href={`/competition/${compSlug}/round/${next.slug}`} className={cls}>{next.label} →</Link> : <span />}
    </nav>
  );
}

const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long" });

function byDay(matches: Match[]): [string, Match[]][] {
  const out = new Map<string, Match[]>();
  for (const m of matches) {
    const d = dayFmt.format(new Date(m.kickoffUtc));
    (out.get(d) ?? out.set(d, []).get(d)!).push(m);
  }
  return [...out];
}

function itemList(compName: string, r: Round): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${compName} ${r.label}`,
    itemListElement: r.matches.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/match/${m.slug}`,
      name: `${m.homeTeam?.name} vs ${m.awayTeam?.name}`,
    })),
  };
}
