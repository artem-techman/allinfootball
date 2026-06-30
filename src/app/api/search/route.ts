import { NextResponse } from "next/server";
import { provider } from "@/lib/providers";
import { COMPETITIONS } from "@/lib/constants/competitions";
import { entitySlug } from "@/lib/utils/slug";

/**
 * GET /api/search?q=<query> — search across the nine competitions (local match)
 * and teams (API-Football). Powers the header autocomplete. Returns
 * { results: [{ type, name, href, sublabel }] }. Degrades to whatever it can
 * resolve; never throws (CLAUDE.md section 10).
 */
export const dynamic = "force-dynamic";

interface Result {
  type: "team" | "player" | "competition";
  name: string;
  href: string;
  sublabel?: string;
}

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const lower = q.toLowerCase();

  const competitions: Result[] = COMPETITIONS.filter((c) => c.name.toLowerCase().includes(lower)).map((c) => ({
    type: "competition",
    name: c.name,
    href: `/competition/${c.slug}/table`,
    sublabel: c.country,
  }));

  let teams: Result[] = [];
  try {
    const [found, inScopeIds] = await Promise.all([provider.searchTeams(q), getInScopeTeamIds()]);
    // Only surface teams that actually play in one of the nine competitions, so a
    // result never leads to an empty/out-of-scope team page. If the in-scope set
    // couldn't be built (all upstream calls failed), don't filter — degrade to the
    // raw results rather than returning nothing.
    const scoped = inScopeIds.size > 0 ? found.filter((t) => inScopeIds.has(t.id)) : found;
    teams = scoped.slice(0, 8).map((t) => ({
      type: "team",
      name: t.name,
      href: `/team/${entitySlug(t.name, t.id)}`,
      sublabel: t.country,
    }));
  } catch {
    teams = [];
  }

  return NextResponse.json({ results: [...competitions, ...teams].slice(0, 8) });
}

/**
 * The set of team ids competing in the nine competitions, used to scope search
 * results. Built from each league's team list and cached in-process for a day
 * (the underlying provider calls are themselves cached for 24h).
 */
let inScopeCache: { ids: Set<number>; expires: number } | null = null;
const IN_SCOPE_TTL_MS = 24 * 60 * 60 * 1000;

async function getInScopeTeamIds(): Promise<Set<number>> {
  if (inScopeCache && inScopeCache.expires > Date.now()) return inScopeCache.ids;
  const lists = await Promise.all(
    COMPETITIONS.map((c) => provider.getTeamsByLeague(c.leagueId, c.defaultSeason).catch(() => [])),
  );
  const ids = new Set<number>();
  for (const list of lists) for (const t of list) ids.add(t.id);
  // Only cache a non-empty set; an empty result is treated as a transient failure
  // so the next request retries instead of caching "everything is out of scope".
  if (ids.size > 0) inScopeCache = { ids, expires: Date.now() + IN_SCOPE_TTL_MS };
  return ids;
}
