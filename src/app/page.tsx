import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { GreetingHeader } from "@/components/shell/GreetingHeader";
import { HeroFeatureCard } from "@/components/cards/HeroFeatureCard";
import { HeroCarousel } from "@/components/cards/HeroCarousel";
import { UpcomingMatches } from "@/components/cards/UpcomingMatches";
import { TopStoriesCard } from "@/components/cards/TopStoriesCard";
import type { StoryItem } from "@/components/cards/TopStoriesCard";
import { PlayerSpotlightCard } from "@/components/cards/PlayerSpotlightCard";
import { LiveNowRail } from "@/components/rail/LiveNowRail";
import { TopTableRail } from "@/components/rail/TopTableRail";
import { TransferRumoursRail } from "@/components/rail/TransferRumoursRail";
import { ChevronRightIcon } from "@/components/primitives/icons";
import { provider } from "@/lib/providers";
import { getNews } from "@/lib/news";
import type { Article, Match, Standing } from "@/lib/providers/types";
import { todayKey, shiftDateKey } from "@/lib/utils/date";
import { DEFAULT_COMPETITION_SLUG, getCompetitionBySlug, isInScope } from "@/lib/constants/competitions";
import { PREVIEW_UPCOMING, PREVIEW_LIVE, PREVIEW_STANDINGS, PREVIEW_STORIES, PREVIEW_SPOTLIGHT, PREVIEW_HERO } from "@/lib/preview/homePreview";

export const dynamic = "force-dynamic";

/**
 * Home dashboard (CLAUDE.md section 8). Three-column shell. News (hero, Top
 * Stories, Transfer Talk) comes from RSS and works regardless of the football
 * API key; Upcoming / Live / Top Table / Player Spotlight use live football data.
 * Each section falls back to preview content if its source is unavailable.
 */
/** Competition the home Top Table widget defaults to. */
const TOP_TABLE_SLUG = "world-cup";

export default async function HomePage() {
  const { upcoming, standings, spotlight, news, transferNews } = await loadHomeData();

  const upcomingToShow = upcoming.length > 0 ? upcoming : PREVIEW_UPCOMING;
  const standingsToShow = standings && standings.length > 0 ? standings : PREVIEW_STANDINGS;

  const heroArticles = news.filter((a) => a.image).slice(0, 5);
  const heroArticle = heroArticles[0];
  const storyPool = news.filter((a) => !heroArticles.includes(a));
  const stories =
    storyPool.length >= 3
      ? { featured: toStory(storyPool[0]), items: storyPool.slice(1, 5).map(toStory) }
      : PREVIEW_STORIES;

  // Rendered beside Top Stories on desktop, but moved to the very end on mobile
  // (after the stacked rail widgets), so it's the last thing the user scrolls to.
  const playerSpotlight = (
    <PlayerSpotlightCard
      name={spotlight?.name ?? PREVIEW_SPOTLIGHT.name}
      href={spotlight?.href ?? "/competition/premier-league/scorers"}
      club={spotlight?.club ?? PREVIEW_SPOTLIGHT.club}
      position={spotlight?.position ?? PREVIEW_SPOTLIGHT.position}
      verified={!spotlight && PREVIEW_SPOTLIGHT.verified}
      matches={spotlight?.matches ?? PREVIEW_SPOTLIGHT.matches}
      goals={spotlight?.goals ?? PREVIEW_SPOTLIGHT.goals}
      assists={spotlight?.assists ?? PREVIEW_SPOTLIGHT.assists}
      portraitUrl={spotlight?.portraitUrl ?? PREVIEW_SPOTLIGHT.portraitUrl}
    />
  );

  return (
    <AppShell
      rail={
        <>
          {/* On the right rail for desktop only — on mobile Live Now is surfaced
              above Upcoming Matches in the main column (see below). */}
          <div className="hidden min-[1201px]:block">
            <LiveNowRail previewMatches={PREVIEW_LIVE} />
          </div>
          <TopTableRail initialSlug={TOP_TABLE_SLUG} initialRows={standingsToShow} />
          <TransferRumoursRail articles={transferNews} />
          {/* On mobile the rail stacks below main, so Player Spotlight here makes
              it the last section. On desktop (≥1024px) it shows beside Top
              Stories instead (see below) and is hidden here. */}
          <div className="lg:hidden">{playerSpotlight}</div>
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
        <LiveNowRail previewMatches={PREVIEW_LIVE} />
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

      {/* Top Stories (enlarged) · Player Spotlight (desktop only here; on mobile
          it's rendered at the end of the rail instead). */}
      <section className="mt-7 grid gap-4 lg:grid-cols-[1.85fr_1fr]">
        <TopStoriesCard featured={stories.featured} items={stories.items} />
        <div className="hidden lg:block">{playerSpotlight}</div>
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

interface HomeSpotlight {
  name: string;
  href: string;
  club: string;
  position?: string;
  matches?: number;
  goals?: number;
  assists?: number;
  portraitUrl?: string;
}

async function loadHomeData(): Promise<{
  upcoming: Match[];
  standings: Standing[] | null;
  spotlight: HomeSpotlight | null;
  news: Article[];
  transferNews: Article[];
}> {
  const keyMissing = !process.env.FOOTBALL_API_KEY;

  // News (RSS) is independent of the football API key.
  const [news, transferNews] = await Promise.all([
    getNews({ limit: 8 }).catch(() => [] as Article[]),
    getNews({ transfer: true, limit: 4 }).catch(() => [] as Article[]),
  ]);

  if (keyMissing) {
    return { upcoming: [], standings: null, spotlight: null, news, transferNews };
  }

  // Top Table defaults to the World Cup (the current marquee event); the Player
  // Spotlight stays on the Premier League top scorer.
  const tableComp = getCompetitionBySlug(TOP_TABLE_SLUG);
  const spotlightComp = getCompetitionBySlug(DEFAULT_COMPETITION_SLUG);
  const [upcoming, standings, spotlight] = await Promise.all([
    loadUpcoming(),
    tableComp ? provider.getStandings(tableComp.leagueId, tableComp.defaultSeason).catch(() => []) : Promise.resolve([]),
    loadSpotlight(spotlightComp?.leagueId ?? 39, spotlightComp?.defaultSeason ?? 2025),
  ]);
  return { upcoming, standings, spotlight, news, transferNews };
}

async function loadSpotlight(leagueId: number, season: number): Promise<HomeSpotlight | null> {
  try {
    const scorers = await provider.getTopScorers(leagueId, season);
    const top = scorers[0];
    if (!top?.player) return null;
    const profile = await provider.getPlayer(top.playerId, season).catch(() => undefined);
    return {
      name: top.player.name,
      href: `/player/${top.player.slug}`,
      club: top.team?.name ?? "",
      position: profile?.player.position,
      matches: profile?.stats.appearances,
      goals: top.goals,
      assists: top.assists,
      portraitUrl: `https://media.api-sports.io/football/players/${top.playerId}.png`,
    };
  } catch {
    return null;
  }
}

async function loadUpcoming(): Promise<Match[]> {
  try {
    const today = todayKey();
    const days = [0, 1, 2, 3].map((d) => shiftDateKey(today, d));
    const batches = await Promise.all(days.map((d) => provider.getFixturesByDate(d).catch(() => [] as Match[])));
    return batches
      .flat()
      .filter((m) => m.status === "scheduled" && isInScope(m.competitionId))
      .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc))
      .slice(0, 12);
  } catch {
    return [];
  }
}
