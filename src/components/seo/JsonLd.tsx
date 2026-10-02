import type { Match, TeamProfile } from "@/lib/providers/types";
import { getCompetitionBySlug } from "@/lib/constants/competitions";
import { SITE_URL as SITE, SITE_NAME } from "@/lib/seo/metadata";

/** Inline JSON-LD <script> (CLAUDE.md section 13). */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify escapes quotes, but a "</script>" inside a team/article
      // name would still close the tag — escape "<" so nothing can break out.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

/**
 * schema.org EventStatusType. There is no "completed" status: a finished match
 * is still EventScheduled (it happened as scheduled). Suspended/abandoned map
 * to the closest available values.
 */
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

function team(name: string | undefined, crest: string | undefined): Record<string, unknown> {
  return { "@type": "SportsTeam", name, ...(crest ? { logo: crest } : {}) };
}

/**
 * SportsEvent for a match page (B19). The competition is expressed as the
 * event's `organizer` (a SportsOrganization is a valid Organization) — NOT as
 * `superEvent`, which must be an Event. Teams appear both as home/away and as
 * `competitor`, which is what Google's event validators read.
 */
export function sportsEvent(match: Match, slug: string): Record<string, unknown> {
  const home = team(match.homeTeam?.name, match.homeTeam?.crest);
  const away = team(match.awayTeam?.name, match.awayTeam?.crest);
  const comp = match.competition ? getCompetitionBySlug(match.competition.slug) : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`,
    sport: "Soccer",
    startDate: match.kickoffUtc,
    eventStatus: EVENT_STATUS[match.status],
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url: `${SITE}/match/${slug}`,
    homeTeam: home,
    awayTeam: away,
    competitor: [home, away],
    ...(match.competition
      ? {
          organizer: {
            "@type": "SportsOrganization",
            name: comp?.name ?? match.competition.name,
            ...(comp ? { url: `${SITE}/competition/${comp.slug}/table` } : {}),
          },
        }
      : {}),
    ...(match.venueName
      ? {
          location: {
            "@type": "Place",
            name: match.venueName,
            ...(match.city ? { address: { "@type": "PostalAddress", addressLocality: match.city } } : {}),
          },
        }
      : {}),
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

/** Site-wide publisher identity — helps Google associate the name, logo and
 *  favicon, and is a building block for rich/knowledge results. */
export function organization(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE,
    logo: `${SITE}/icon-512.png`,
  };
}

/** WebSite identity. (No SearchAction — there is no on-site search results page
 *  to point it at; advertising one Google can't use would be misleading.) */
export function website(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE,
    publisher: { "@type": "Organization", name: SITE_NAME, logo: `${SITE}/icon-512.png` },
  };
}

export interface Crumb {
  name: string;
  path: string;
}

/**
 * Breadcrumb for a competition: its Table page. The bare /competition/[slug]
 * URL is a redirect, and crumbs must point at pages that answer 200 (B19).
 * Out-of-scope competitions have no page at all, so they get no crumb.
 */
export function competitionTableCrumb(competition: { slug: string; name: string }): Crumb[] {
  const comp = getCompetitionBySlug(competition.slug);
  return comp ? [{ name: comp.name, path: `/competition/${comp.slug}/table` }] : [];
}

/**
 * BreadcrumbList. Only pass crumbs whose paths render 200 — there is no /teams
 * or /players index, and /competition/[slug] redirects (B19).
 */
export function breadcrumb(items: Crumb[]): Record<string, unknown> {
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
