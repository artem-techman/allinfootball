import { NextResponse } from "next/server";
import { provider } from "@/lib/providers";
import { searchKnownPlayers } from "@/lib/providers/scoped";
import { COMPETITIONS } from "@/lib/constants/competitions";
import { entitySlug } from "@/lib/utils/slug";

/**
 * GET /api/search?q=<query> — competitions, teams and players, all matched
 * LOCALLY: teams from our in-scope fixture lists (with nickname aliases — Spurs,
 * Man Utd, PSG, Barça …), players from the competitions' top-scorer lists. A
 * keystroke never costs a provider call (it used to cost one per new string).
 * Returns { results: [{ type, name, href, sublabel }] }; never throws.
 */
export const dynamic = "force-dynamic";

interface Result {
  type: "team" | "player" | "competition";
  name: string;
  href: string;
  sublabel?: string;
}

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ results: [] });

  const lower = q.toLowerCase();
  const competitions: Result[] = COMPETITIONS.filter((c) => c.name.toLowerCase().includes(lower)).map((c) => ({
    type: "competition",
    name: c.name,
    href: `/competition/${c.slug}/table`,
    sublabel: c.country,
  }));

  const [teams, players] = await Promise.all([
    provider.searchTeams(q).catch(() => []),
    searchKnownPlayers(provider, q).catch(() => []),
  ]);

  const results: Result[] = [
    ...competitions,
    ...teams.slice(0, 6).map((t) => ({
      type: "team" as const,
      name: t.name,
      href: `/team/${entitySlug(t.name, t.id)}`,
      sublabel: t.country,
    })),
    ...players.slice(0, 4).map((p) => ({
      type: "player" as const,
      name: p.name,
      href: `/player/${entitySlug(p.name, p.id)}`,
      sublabel: p.teamName,
    })),
  ];
  return NextResponse.json(
    { results: results.slice(0, 10) },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
