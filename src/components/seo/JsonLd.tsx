import type { Match, TeamProfile } from "@/lib/providers/types";

const SITE = "https://myfootballtracker.com";

/** Inline JSON-LD <script> (CLAUDE.md section 13). */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe to inline here (no user-controlled HTML).
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

const EVENT_STATUS: Record<Match["status"], string> = {
  scheduled: "https://schema.org/EventScheduled",
  live: "https://schema.org/EventScheduled",
  ht: "https://schema.org/EventScheduled",
  finished: "https://schema.org/EventScheduled",
  postponed: "https://schema.org/EventPostponed",
  cancelled: "https://schema.org/EventCancelled",
  abandoned: "https://schema.org/EventCancelled",
  suspended: "https://schema.org/EventPostponed",
};

export function sportsEvent(match: Match, slug: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`,
    sport: "Soccer",
    startDate: match.kickoffUtc,
    eventStatus: EVENT_STATUS[match.status],
    url: `${SITE}/match/${slug}`,
    homeTeam: { "@type": "SportsTeam", name: match.homeTeam?.name, logo: match.homeTeam?.crest },
    awayTeam: { "@type": "SportsTeam", name: match.awayTeam?.name, logo: match.awayTeam?.crest },
    ...(match.competition ? { superEvent: { "@type": "SportsOrganization", name: match.competition.name } } : {}),
    ...(match.venueName ? { location: { "@type": "Place", name: match.venueName, address: match.city } } : {}),
  };
}

export function sportsTeam(profile: TeamProfile, slug: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name: profile.team.name,
    sport: "Soccer",
    url: `${SITE}/team/${slug}`,
    logo: profile.team.crest,
    ...(profile.founded ? { foundingDate: String(profile.founded) } : {}),
    ...(profile.country ? { location: { "@type": "Country", name: profile.country } } : {}),
  };
}

export function breadcrumb(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE}${it.path}`,
    })),
  };
}
