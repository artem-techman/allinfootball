import "server-only";
import { getCompetitionBySlug } from "@/lib/constants/competitions";
import { seasonYearFor } from "@/lib/season";
import { readyDb, withTimeout } from "@/lib/db/neon";

/**
 * Player pages for search. The SEO job saves every squad player's season profile
 * (from `/players?team=`, ~2 requests per team) under `player:{id}:{season}`;
 * player pages read that copy for robots, so crawling them costs no quota.
 */

/** The season player pages show (the page and the warm-up job must agree). */
export function playerSeason(): number {
  return seasonYearFor(getCompetitionBySlug("premier-league")!);
}

export interface SavedPlayer {
  id: number;
  name: string;
  appearances: number;
  contributions: number;
}

/** Saved players who have played this season, most goals + assists first (the sitemap). */
export async function savedPlayers(season = playerSeason()): Promise<SavedPlayer[]> {
  const sql = await readyDb(3_000);
  if (!sql) return [];
  try {
    const rows = (await withTimeout(
      sql`
        select (body->'player'->>'id')::int as id,
               body->'player'->>'name' as name,
               coalesce((body->'stats'->>'appearances')::int, 0) as apps,
               coalesce((body->'stats'->>'goals')::int, 0) + coalesce((body->'stats'->>'assists')::int, 0) as ga
        from provider_cache
        where key like ${`player:%:${season}`}
          and coalesce((body->'stats'->>'appearances')::int, 0) > 0
        order by ga desc, apps desc
        limit 20000
      ` as unknown as Promise<{ id: number; name: string; apps: number; ga: number }[]>,
      8_000,
      [],
    )) as { id: number; name: string; apps: number; ga: number }[];
    return rows
      .filter((r) => r.id && r.name)
      .map((r) => ({ id: r.id, name: r.name, appearances: r.apps, contributions: r.ga }));
  } catch {
    return [];
  }
}
