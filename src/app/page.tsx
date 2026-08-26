import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { GreetingHeader } from "@/components/shell/GreetingHeader";
import { HeroFeatureCard } from "@/components/cards/HeroFeatureCard";
import { HeroCarousel } from "@/components/cards/HeroCarousel";
import { UpcomingMatches } from "@/components/cards/UpcomingMatches";
import { TopStoriesCard } from "@/components/cards/TopStoriesCard";
import type { StoryItem } from "@/components/cards/TopStoriesCard";
import { TopScorersCard } from "@/components/cards/TopScorersCard";
import type { ScorerItem } from "@/components/cards/TopScorersCard";
import { LiveNowRail } from "@/components/rail/LiveNowRail";
import { TopTableRail } from "@/components/rail/TopTableRail";
import { LatestResultsRail } from "@/components/rail/LatestResultsRail";
import { TransferRumoursRail } from "@/components/rail/TransferRumoursRail";
import { ChevronRightIcon } from "@/components/primitives/icons";
import { provider } from "@/lib/providers";
import { getNews } from "@/lib/news";
import type { Article, Match, Standing } from "@/lib/providers/types";
import { todayKey, shiftDateKey } from "@/lib/utils/date";
import { getCompetitionBySlug, isInScope } from "@/lib/constants/competitions";
import { currentSeasonYear } from "@/lib/season";
import { PREVIEW_UPCOMING, PREVIEW_RESULTS, PREVIEW_STANDINGS, PREVIEW_STORIES, PREVIEW_SCORERS, PREVIEW_HERO } from "@/lib/preview/homePreview";

export const dynamic = "force-dynamic";

export const metadata = { alternates: { canonical: "/" } };

/**
 * Home dashboard (CLAUDE.md section 8). Three-column shell. News (hero, Top
 * Stories, Transfer Talk) comes from RSS and works regardless of the football
 * API key; Upcoming / Live / Top Table / Player Spotlight use live football data.
 * Each section falls back to preview content if its source is unavailable.
 */
/** Competition the home Top Table widget defaults to (users can still switch it
 *  via the picker). The Premier League is the site's default home competition. */
const TOP_TABLE_SLUG = "premier-league";

/** Competition behind the home Top Scorers leaderboard card. */
const TOP_SCORERS_SLUG = "premier-league";

export default async function HomePage() {
  const { upcoming, results, standings, scorers, news, transferNews, demo } = await loadHomeData();

  // Sample data renders ONLY in the keyless demo. With a real key, a failed or
  // empty provider call must show nothing — never invented fixtures, results or
  // brackets dressed up as real (a transient failure once rendered a fictional
  // World Cup bracket containing teams that aren't in the tournament). Every one
  // of these widgets hides itself on an empty array.
  const upcomingToShow = upcoming.length > 0 ? upcoming : demo ? PREVIEW_UPCOMING : [];
  const resultsToShow = results.length > 0 ? results : demo ? PREVIEW_RESULTS : [];
  const standingsToShow =
    standings && standings.length > 0 ? standings : demo ? PREVIEW_STANDINGS : [];

  const heroArticles = news.filter((a) => a.image).slice(0, 5);
  const storyPool = news.filter((a) => !heroArticles.includes(a));
  const stories =
    storyPool.length >= 3
      ? { featured: toStory(storyPool[0]), items: storyPool.slice(1, 5).map(toStory) }
      : PREVIEW_STORIES;

  // Top scorers — rendered beside Top Stories on desktop, but moved to the very
  // end on mobile (after the stacked rail widgets), so it's the last section the
  // user scrolls to.
  const scorersToShow = scorers.length > 0 ? scorers : demo ? PREVIEW_SCORERS : [];
  const topScorers = (
    <TopScorersCard
      scorers={scorersToShow}
      competitionLabel="Premier League"
      scorersHref="/competition/premier-league/scorers"
    />
  );

  // Soonest upcoming fixture — shown with a countdown in the Live Now rail when
  // nothing is live.
  const nextUpcoming = upcomingToShow[0];

  return (
    <AppShell
      rail={
        <>
          {/* On the right rail for desktop only — on mobile Live Now is surfaced
              above Upcoming Matches in the main column (see below). */}
          <div className="hidden min-[1201px]:block">
            <LiveNowRail nextMatch={nextUpcoming} />
          </div>
          <LatestResultsRail matches={resultsToShow} />
          <TopTableRail initialSlug={TOP_TABLE_SLUG} initialRows={standingsToShow} />
          <TransferRumoursRail articles={transferNews} />
          {/* On mobile the rail stacks below main, so the Top Scorers card here
              makes it the last section. On desktop (≥1024px) it shows beside
              Top Stories instead (see below) and is hidden here. */}
          <div className="lg:hidden">{topScorers}</div>
        </>
      }
    >
      <GreetingHeader />

      {heroArticles.length > 0 ? (
        <HeroCarousel
          slides={heroArticles.map((a) => ({
            tag: heroTag(a),
            headline: a.title,
            dek: a.dek,
            href: `/news/${a.slug}`,
            ctaLabel: "Read story",
            imageUrl: a.image,
          }))}
        />
      ) : (
        <HeroFeatureCard
          tag={PREVIEW_HERO.tag}
          headline={PREVIEW_HERO.headline}
          headlineAccent={PREVIEW_HERO.headlineAccent}
          dek={PREVIEW_HERO.dek}
          href="/news"
          imageUrl={PREVIEW_HERO.imageUrl}
          score={PREVIEW_HERO.score}
        />
      )}

      {/* Live Now — surfaced above Upcoming on mobile so live games come first
          while scrolling; hidden on desktop where it lives in the right rail. */}
      <div className="mt-7 min-[1201px]:hidden">
        <LiveNowRail nextMatch={nextUpcoming} />
      </div>

      {/* Upcoming Matches */}
      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-section text-text-primary">Upcoming Matches</h2>
          <Link href="/matches" className="flex items-center gap-1 text-[12px] font-semibold text-text-secondary hover:text-text-primary">
            See all <ChevronRightIcon size={15} />
          </Link>
        </div>
        <UpcomingMatches matches={upcomingToShow} />
      </section>

      {/* Top Stories (enlarged) · Top Scorers (desktop only here; on mobile it's
          rendered at the end of the rail instead). Two columns only
          when the sidebar is collapsed — when it's expanded the main column is
          too narrow, so they stack to one column to avoid clipping. */}
      <section className="mt-7 grid grid-cols-1 gap-4 sidebar-collapsed:lg:grid-cols-[1.85fr_1fr]">
        <TopStoriesCard featured={stories.featured} items={stories.items} />
        <div className="hidden lg:block">{topScorers}</div>
      </section>
    </AppShell>
  );
}

/* --------------------------------- helpers --------------------------------- */

function heroTag(a: Article): string {
  const comp = a.competitionTags[0] ? getCompetitionBySlug(a.competitionTags[0]) : undefined;
  return comp?.name ?? a.sourceName;
}

function toStory(a: Article): StoryItem {
  const comp = a.competitionTags[0] ? getCompetitionBySlug(a.competitionTags[0]) : undefined;
  return {
    id: a.id,
    title: a.title,
    href: `/news/${a.slug}`,
    publishedAtUtc: a.publishedAtUtc,
    image: a.image,
    tag: comp?.name,
  };
}

async function loadHomeData(): Promise<{
  upcoming: Match[];
  results: Match[];
  standings: Standing[] | null;
  scorers: ScorerItem[];
  news: Article[];
  transferNews: Article[];
  /** True only in the keyless demo — the ONLY case where sample data may render. */
  demo: boolean;
}> {
  const keyMissing = !process.env.FOOTBALL_API_KEY;

  // News (RSS) is independent of the football API key.
  const [news, transferNews] = await Promise.all([
    getNews({ limit: 8 }).catch(() => [] as Article[]),
    getNews({ transfer: true, limit: 4 }).catch(() => [] as Article[]),
  ]);

  if (keyMissing) {
    return { upcoming: [], results: [], standings: null, scorers: [], news, transferNews, demo: true };
  }

  // Top Table defaults to the Premier League; the scorers leaderboard is the
  // World Cup. The Top Table season is resolved live (current season).
  const tableComp = getCompetitionBySlug(TOP_TABLE_SLUG);
  const [windowMatches, standings, scorers] = await Promise.all([
    loadFixturesWindow(),
    tableComp
      ? currentSeasonYear(tableComp)
          .then((season) => provider.getStandings(tableComp.leagueId, season))
          .catch(() => [])
      : Promise.resolve([]),
    loadTopScorers(),
  ]);
  // One date window feeds both: soonest scheduled = upcoming, latest finished = results.
  const upcoming = windowMatches
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc))
    .slice(0, 12);
  // 5, not 3: MLS kicks off late US-evening, so a batch of MLS results can bump
  // a marquee World Cup tie off a 3-item list within hours of it finishing.
  const results = windowMatches
    .filter((m) => m.status === "finished")
    .sort((a, b) => b.kickoffUtc.localeCompare(a.kickoffUtc))
    .slice(0, 5);
  return { upcoming, results, standings, scorers, news, transferNews, demo: false };
}

/** Biggest goal scorers of the Premier League, as a compact leaderboard (top 5). */
async function loadTopScorers(): Promise<ScorerItem[]> {
  const comp = getCompetitionBySlug(TOP_SCORERS_SLUG);
  if (!comp) return [];
  try {
    const season = await currentSeasonYear(comp);
    const scorers = await provider.getTopScorers(comp.leagueId, season);
    return scorers.slice(0, 5).map((s) => ({
      rank: s.rank,
      name: s.player?.name ?? "Unknown",
      href: s.player?.slug ? `/player/${s.player.slug}` : `/competition/${TOP_SCORERS_SLUG}/scorers`,
      team: s.team?.name ?? "",
      teamCrest: s.team?.crest,
      portraitUrl: `https://media.api-sports.io/football/players/${s.playerId}.png`,
      goals: s.goals,
      assists: s.assists,
    }));
  } catch {
    return [];
  }
}

/** In-scope fixtures across a ±3 day window — the source for both Upcoming and
 *  Latest Results. Each date is cached upstream, so this stays quota-light. */
async function loadFixturesWindow(): Promise<Match[]> {
  try {
    const today = todayKey();
    const days = [-3, -2, -1, 0, 1, 2, 3].map((d) => shiftDateKey(today, d));
    const batches = await Promise.all(days.map((d) => provider.getFixturesByDate(d).catch(() => [] as Match[])));
    return batches.flat().filter((m) => isInScope(m.competitionId, m.round));
  } catch {
    return [];
  }
}
