import type { MetadataRoute } from "next";
import { COMPETITIONS } from "@/lib/constants/competitions";
import { provider } from "@/lib/providers";
import { seasonYearFor } from "@/lib/season";
import { toDateKey } from "@/lib/utils/date";
import type { Match } from "@/lib/providers/types";

const SITE = "https://myfootballtracker.com";
const DAY = 24 * 3600_000;

/**
 * Sitemap: current-season match pages (next 3 weeks first — search demand for a
 * fixture peaks in the days before kick-off, and Google needs those days to find
 * it), every team, matchday pages (last week → next month), competitions and
 * the static pages. Built from the saved season fixture lists: when a crawler
 * fetches this, no provider request is made (robots get saved data only).
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = Date.now();
  const today = new Date(now);
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: today, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE}/matches`, lastModified: today, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE}/feed`, lastModified: today, changeFrequency: "hourly", priority: 0.6 },
    { url: `${SITE}/news`, lastModified: today, changeFrequency: "hourly", priority: 0.6 },
    { url: `${SITE}/about`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITE}/terms`, changeFrequency: "yearly", priority: 0.1 },
  ];
  for (const c of COMPETITIONS) {
    for (const tab of ["table", "fixtures", "scorers", "news"]) {
      entries.push({ url: `${SITE}/competition/${c.slug}/${tab}`, lastModified: today, changeFrequency: "daily", priority: tab === "table" ? 0.8 : 0.6 });
    }
  }

  const lists = await Promise.all(
    COMPETITIONS.map((c) => provider.getFixturesByLeague(c.leagueId, seasonYearFor(c)).catch(() => [] as Match[])),
  );
  const fixtures = lists.flat();

  // Matches: soonest upcoming first, then the rest of the season ahead, then results.
  const ko = (m: Match) => Date.parse(m.kickoffUtc);
  const soon = fixtures.filter((m) => m.status !== "finished" && ko(m) >= now - 3 * 3600_000 && ko(m) <= now + 21 * DAY).sort((a, b) => ko(a) - ko(b));
  const later = fixtures.filter((m) => m.status !== "finished" && ko(m) > now + 21 * DAY).sort((a, b) => ko(a) - ko(b));
  const played = fixtures.filter((m) => m.status === "finished").sort((a, b) => ko(b) - ko(a));
  for (const m of soon) entries.push({ url: `${SITE}/match/${m.slug}`, lastModified: today, changeFrequency: "hourly", priority: 0.9 });
  for (const m of later) entries.push({ url: `${SITE}/match/${m.slug}`, lastModified: new Date(Math.min(now, ko(m) - 21 * DAY)), changeFrequency: "weekly", priority: 0.5 });
  for (const m of played) entries.push({ url: `${SITE}/match/${m.slug}`, lastModified: new Date(ko(m) + 3 * 3600_000), changeFrequency: "monthly", priority: 0.6 });

  // Teams.
  const teams = new Map<number, string>();
  for (const m of fixtures) for (const t of [m.homeTeam, m.awayTeam]) if (t) teams.set(t.id, t.slug);
  for (const slug of teams.values()) entries.push({ url: `${SITE}/team/${slug}`, lastModified: today, changeFrequency: "daily", priority: 0.6 });

  // Matchday pages with fixtures: the last week and the next month.
  const days = new Set<string>();
  for (const m of fixtures) if (ko(m) >= now - 7 * DAY && ko(m) <= now + 30 * DAY) days.add(toDateKey(new Date(m.kickoffUtc)));
  for (const d of [...days].sort()) entries.push({ url: `${SITE}/matches/${d}`, lastModified: today, changeFrequency: "daily", priority: 0.5 });

  return entries;
}
