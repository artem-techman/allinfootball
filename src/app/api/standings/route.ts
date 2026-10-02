import { NextResponse } from "next/server";
import { provider } from "@/lib/providers";
import { getCompetitionByLeagueId } from "@/lib/constants/competitions";
import { currentSeasonYear } from "@/lib/season";

/**
 * GET /api/standings?league=<id>[&season=<year>] — competition standings (linear
 * or grouped; the client decides how to render via groupLabel). When `season` is
 * omitted it resolves the competition's current season, so the Top Table picker
 * always lands on the live campaign. Degrades to an empty list with
 * `delayed: true` on provider failure (CLAUDE.md section 10).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const league = Number(searchParams.get("league"));
  if (!Number.isFinite(league)) {
    return NextResponse.json({ error: "invalid league" }, { status: 400 });
  }
  // NOTE: Number(null) === 0 and Number("") === 0, both of which pass
  // Number.isFinite — so we must check the raw param is actually present before
  // trusting it, otherwise an omitted season silently becomes 0 (→ "Season cannot
  // be 0") and the resolver never runs. This broke the Top Table picker.
  const seasonRaw = searchParams.get("season");
  const seasonParam = seasonRaw != null && seasonRaw.trim() !== "" ? Number(seasonRaw) : NaN;
  const comp = getCompetitionByLeagueId(league);
  const season = Number.isFinite(seasonParam)
    ? seasonParam
    : comp
      ? await currentSeasonYear(comp)
      : new Date().getUTCFullYear();

  try {
    const standings = await provider.getStandings(league, season);
    return NextResponse.json(
      { standings },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=120" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { standings: [], delayed: true, reason: message.includes("FOOTBALL_API_KEY") ? "no_key" : "provider_error" },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
