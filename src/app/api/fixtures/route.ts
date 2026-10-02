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

// Healthy answers are shared at the CDN for a short while; degraded ones never
// are, so a provider blip can't be cached and served to everyone.
const HEALTHY = { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30" };
const NO_STORE = { "Cache-Control": "no-store" };

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
      return NextResponse.json({ matches }, { headers: HEALTHY });
    }

    const date = searchParams.get("date") ?? todayKey();
    if (!isValidDateKey(date)) {
      return NextResponse.json({ error: "invalid date" }, { status: 400 });
    }
    // Only our competitions (it used to ship every fixture worldwide — ~340
    // matches, ~200 KB — to every calendar poll).
    const matches = await provider.getFixturesByDate(date);
    return NextResponse.json({ matches }, { headers: HEALTHY });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { matches: [], delayed: true, reason: message.includes("FOOTBALL_API_KEY") ? "no_key" : "provider_error" },
      { status: 200, headers: NO_STORE },
    );
  }
}
