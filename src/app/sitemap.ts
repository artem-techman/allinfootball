import type { MetadataRoute } from "next";
import { COMPETITIONS } from "@/lib/constants/competitions";
import { provider } from "@/lib/providers";
import { seasonYearFor } from "@/lib/season";
import { toDateKey } from "@/lib/utils/date";
import { entitySlug } from "@/lib/utils/slug";
import { savedPlayers } from "@/lib/seo/players";
import { groupRounds, indexableRounds } from "@/lib/seo/rounds";
import type { Match } from "@/lib/providers/types";

const SITE = "https://myfootballtracker.com";
const DAY = 24 * 3600_000;

/**
 * Sitemap: current-season match pages (next 3 weeks first — search demand for a
 * fixture peaks in the days before kick-off, and Google needs those days to find
 * it), every team, matchday pages (last week → next month), competitions, the
 * static pages, and every saved player who has played this season. Built from the saved season fixture lists: when a crawler
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
    { url: `${SITE}/pep`, lastModified: today, changeFrequency: "hourly", priority: 0.7 },
    { url: `${SITE}/about`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITE}/terms`, changeFrequency: "yearly", priority: 0.1 },
  ];
  const lists = await Promise.all(
    COMPETITIONS.map((c) => provider.getFixturesByLeague(c.leagueId, seasonYearFor(c)).catch(() => [] as Match[])),
  );
  const fixtures = lists.flat();

  // lastmod is when a page's content really changed, roughly the last full time
  // that touches it. It used to be "now" for 7,000 of 8,500 URLs, which teaches
  // Google and Bing to ignore it (2026-11 audit). Unknown → left out.
  const ko = (m: Match) => Date.parse(m.kickoffUtc);
  const fullTime = (m: Match) => new Date(Math.min(now, ko(m) + 3 * 3600_000));
  const lastPlayed = (ms: Match[]) => {
    let latest: Match | undefined;
    for (const m of ms) if (m.status === "finished" && (!latest || ko(m) > ko(latest))) latest = m;
    return latest ? fullTime(latest) : undefined;
  };

  COMPETITIONS.forEach((c, i) => {
    const changed = lastPlayed(lists[i] ?? []);
    for (const tab of ["table", "fixtures", "scorers", "news"]) {
      entries.push({ url: `${SITE}/competition/${c.slug}/${tab}`, lastModified: tab === "news" ? today : changed, changeFrequency: "daily", priority: tab === "table" ? 0.8 : 0.6 });
    }
  });

  // Matches: soonest upcoming first, then the rest of the season ahead, then results.
  const soon = fixtures.filter((m) => m.status !== "finished" && ko(m) >= now - 3 * 3600_000 && ko(m) <= now + 21 * DAY).sort((a, b) => ko(a) - ko(b));
  const later = fixtures.filter((m) => m.status !== "finished" && ko(m) > now + 21 * DAY).sort((a, b) => ko(a) - ko(b));
  const played = fixtures.filter((m) => m.status === "finished").sort((a, b) => ko(b) - ko(a));
  for (const m of soon) entries.push({ url: `${SITE}/match/${m.slug}`, lastModified: today, changeFrequency: "hourly", priority: 0.9 });
  for (const m of later) entries.push({ url: `${SITE}/match/${m.slug}`, changeFrequency: "weekly", priority: 0.5 });
  for (const m of played) entries.push({ url: `${SITE}/match/${m.slug}`, lastModified: fullTime(m), changeFrequency: "monthly", priority: 0.6 });

  // Teams: they change when the team plays.
  const teams = new Map<number, { slug: string; matches: Match[] }>();
  for (const m of fixtures) {
    for (const t of [m.homeTeam, m.awayTeam]) {
      if (!t) continue;
      const entry = teams.get(t.id) ?? { slug: t.slug, matches: [] };
      entry.matches.push(m);
      teams.set(t.id, entry);
    }
  }
  for (const { slug, matches } of teams.values()) {
    const changed = lastPlayed(matches);
    entries.push({ url: `${SITE}/team/${slug}`, lastModified: changed, changeFrequency: "daily", priority: 0.6 });
    // One URL per search intent ("arsenal fixtures", "arsenal results", "arsenal squad").
    entries.push({ url: `${SITE}/team/${slug}/fixtures`, lastModified: changed, changeFrequency: "daily", priority: 0.6 });
    entries.push({ url: `${SITE}/team/${slug}/results`, lastModified: changed, changeFrequency: "daily", priority: 0.6 });
    entries.push({ url: `${SITE}/team/${slug}/squad`, changeFrequency: "weekly", priority: 0.5 });
  }

  // Round pages: every round played or in play, plus the next two.
  COMPETITIONS.forEach((c, i) => {
    for (const r of indexableRounds(groupRounds(c.slug, lists[i] ?? []))) {
      const live = r.state !== "complete";
      entries.push({
        url: `${SITE}/competition/${c.slug}/round/${r.slug}`,
        lastModified: live ? today : new Date(Math.min(now, Date.parse(r.endUtc) + 3 * 3600_000)),
        changeFrequency: live ? "hourly" : "monthly",
        priority: live ? 0.8 : 0.6,
      });
    }
  });

  // Matchday pages with fixtures: the last week and the next month. A day's page
  // last changed at its final full time (or now, while it's being played).
  const days = new Map<string, Match[]>();
  for (const m of fixtures) {
    if (ko(m) < now - 7 * DAY || ko(m) > now + 30 * DAY) continue;
    const d = toDateKey(new Date(m.kickoffUtc));
    (days.get(d) ?? days.set(d, []).get(d)!).push(m);
  }
  for (const d of [...days.keys()].sort()) {
    const started = days.get(d)!.filter((m) => ko(m) <= now);
    const changed = started.length ? new Date(Math.min(now, Math.max(...started.map(ko)) + 3 * 3600_000)) : undefined;
    entries.push({ url: `${SITE}/matches/${d}`, lastModified: changed, changeFrequency: "daily", priority: 0.5 });
  }

  // Players who have played this season (saved by the SEO job), most goals + assists first.
  for (const p of await savedPlayers()) {
    entries.push({ url: `${SITE}/player/${entitySlug(p.name, p.id)}`, changeFrequency: "weekly", priority: p.contributions > 0 ? 0.6 : 0.4 });
  }

  return entries;
}
