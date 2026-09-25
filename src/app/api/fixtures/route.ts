import { NextResponse } from "next/server";
import { provider } from "@/lib/providers";
import { isValidDateKey, todayKey } from "@/lib/utils/date";

/**
 * GET /api/fixtures?date=YYYY-MM-DD  — fixtures on a date (default today)
 * GET /api/fixtures?league=39&season=2025 — fixtures for a league+season
 *
 * Proxies the adapter (key server-side). Degrades to an empty list with
 * `delayed: true` on provider failure (CLAUDE.md section 10).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get("league");
  const season = searchParams.get("season");

  try {
    if (league) {
      const leagueId = Number(league);
      const seasonYear = Number(season);
      if (!Number.isFinite(leagueId) || !Number.isFinite(seasonYear)) {
        return NextResponse.json({ error: "invalid league/season" }, { status: 400 });
      }
      const matches = await provider.getFixturesByLeague(leagueId, seasonYear);
      return NextResponse.json({ matches });
    }

    const date = searchParams.get("date") ?? todayKey();
    if (!isValidDateKey(date)) {
      return NextResponse.json({ error: "invalid date" }, { status: 400 });
    }
    const matches = await provider.getFixturesByDate(date);
    return NextResponse.json({ matches });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { matches: [], delayed: true, reason: message.includes("FOOTBALL_API_KEY") ? "no_key" : "provider_error" },
      { status: 200 },
    );
  }
}
