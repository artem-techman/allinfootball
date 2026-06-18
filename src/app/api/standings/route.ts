import { NextResponse } from "next/server";
import { provider } from "@/lib/providers";

/**
 * GET /api/standings?league=<id>&season=<year> — competition standings (linear
 * or grouped; the client decides how to render via groupLabel). Degrades to an
 * empty list with `delayed: true` on provider failure (CLAUDE.md section 10).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const league = Number(searchParams.get("league"));
  const season = Number(searchParams.get("season"));
  if (!Number.isFinite(league) || !Number.isFinite(season)) {
    return NextResponse.json({ error: "invalid league/season" }, { status: 400 });
  }

  try {
    const standings = await provider.getStandings(league, season);
    return NextResponse.json({ standings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { standings: [], delayed: true, reason: message.includes("FOOTBALL_API_KEY") ? "no_key" : "provider_error" },
      { status: 200 },
    );
  }
}
