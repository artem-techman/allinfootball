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
    const found = await provider.searchTeams(q);
    teams = found.slice(0, 8).map((t) => ({
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
