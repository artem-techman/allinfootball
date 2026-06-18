import type { MetadataRoute } from "next";
import { COMPETITIONS } from "@/lib/constants/competitions";
import { provider } from "@/lib/providers";
import { entitySlug } from "@/lib/utils/slug";

const SITE = "https://allinfootball.com";

/**
 * Sitemap (CLAUDE.md section 13): home, the nine competition hubs (+ sub-pages),
 * the calendar, news, and a best-effort set of team pages from the league
 * tables. Degrades gracefully if the provider is unavailable.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE}/matches`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE}/news`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
  ];

  for (const c of COMPETITIONS) {
    for (const tab of ["fixtures", "table", "scorers", "news"]) {
      entries.push({
        url: `${SITE}/competition/${c.slug}/${tab}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  }

  // Best-effort team pages from the league standings (cached upstream).
  const leagueComps = COMPETITIONS.filter((c) => c.type === "league");
  const standingsBatches = await Promise.all(
    leagueComps.map((c) => provider.getStandings(c.leagueId, c.defaultSeason).catch(() => [])),
  );
  const seen = new Set<number>();
  for (const rows of standingsBatches) {
    for (const r of rows) {
      if (!r.team || seen.has(r.teamId)) continue;
      seen.add(r.teamId);
      entries.push({
        url: `${SITE}/team/${entitySlug(r.team.name, r.team.id)}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.6,
      });
    }
  }

  return entries;
}
