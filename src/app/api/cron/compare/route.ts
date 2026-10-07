import { NextResponse } from "next/server";
import { guardedProvider, storeBackedProvider } from "@/lib/providers";
import { getCompetitionBySlug } from "@/lib/constants/competitions";
import { seasonYearFor } from "@/lib/season";
import { todayKey, shiftDateKey } from "@/lib/utils/date";
import type { Match } from "@/lib/providers/types";

// TEMPORARY (cut-over check): the same queries through the store and through the
// current path, side by side. Protected by CRON_SECRET. Remove after cut-over.
export const dynamic = "force-dynamic";

const brief = (ms: Match[]) => ms.map((m) => `${m.id}:${m.status}:${m.homeScore ?? "-"}-${m.awayScore ?? "-"}`).sort();

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const pl = getCompetitionBySlug("premier-league")!;
  const out: Record<string, unknown> = {};
  for (const d of [-1, 0, 1, 10]) {
    const date = shiftDateKey(todayKey(), d);
    const [a, b] = await Promise.all([storeBackedProvider.getFixturesByDate(date), guardedProvider.getFixturesByDate(date)]);
    const sa = brief(a), sb = brief(b);
    out[`date ${date}`] = { store: sa.length, current: sb.length, onlyStore: sa.filter((x) => !sb.includes(x)), onlyCurrent: sb.filter((x) => !sa.includes(x)) };
  }
  const [ta, tb] = await Promise.all([
    storeBackedProvider.getStandings(pl.leagueId, seasonYearFor(pl)),
    guardedProvider.getStandings(pl.leagueId, seasonYearFor(pl)),
  ]);
  out.plTable = { store: ta.map((r) => r.teamId).slice(0, 5), current: tb.map((r) => r.teamId).slice(0, 5) };
  const [la, lb] = await Promise.all([storeBackedProvider.getLiveFixtures(), guardedProvider.getLiveFixtures()]);
  out.live = { store: brief(la), current: brief(lb) };
  out.search = (await storeBackedProvider.searchTeams("spurs")).map((t) => t.name);
  out.arsenalNext = (await storeBackedProvider.getTeamFixtures(42, { next: 3 })).map((m) => `${m.homeTeam?.name} v ${m.awayTeam?.name}`);
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
