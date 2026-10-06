import { NextResponse } from "next/server";
import { provider } from "@/lib/providers";
import { readLiveSnapshot, writeLiveSnapshot } from "@/lib/db/matchStore";
import { todayKey, shiftDateKey } from "@/lib/utils/date";
import type { Match } from "@/lib/providers/types";

/**
 * The soonest upcoming in-scope fixture, for the "Up next" countdown on pages
 * that don't render their own fixture list (news, transfers). Read from the
 * cached season lists — no provider call.
 */
async function nextFixture(): Promise<Match | null> {
  const now = Date.now();
  for (let d = 0; d < 14; d += 1) {
    const day = await provider.getFixturesByDate(shiftDateKey(todayKey(), d)).catch(() => [] as Match[]);
    const next = day.find((m) => m.status === "scheduled" && Date.parse(m.kickoffUtc) > now);
    if (next) return next;
  }
  return null;
}

/**
 * GET /api/live — live fixtures across the nine competitions.
 *
 * Reads the shared Neon snapshot first: if it's fresher than the live TTL,
 * the request costs ZERO provider API calls no matter how many visitors are
 * polling (the snapshot is shared across all serverless instances). Only a
 * stale snapshot triggers one upstream refresh, which is written back for
 * everyone else. If the provider fails (outage, daily budget spent), we serve
 * the last-known snapshot for a bounded window — flagged `delayed` so the UI
 * shows its data-may-be-delayed banner — instead of an empty widget.
 * (CLAUDE.md section 10: degrade gracefully, never crash.)
 */
export const dynamic = "force-dynamic";

// Every visitor polls the same live list: share it at the CDN for 10s. Degraded
// answers are never cached (a blip must not be served to everyone).
const HEALTHY = { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=10" };
const NO_STORE = { "Cache-Control": "no-store" };

const SNAPSHOT_FRESH_S = 30; // matches TTL.live
const SNAPSHOT_STALE_MAX_S = 15 * 60; // outage window: serve last-known scores up to 15 min

export async function GET() {
  const [snapshot, next] = await Promise.all([readLiveSnapshot(), nextFixture()]);
  if (snapshot && snapshot.ageSeconds <= SNAPSHOT_FRESH_S) {
    return NextResponse.json({ matches: snapshot.matches, next }, { headers: HEALTHY });
  }

  try {
    const matches = await provider.getLiveFixtures();
    await writeLiveSnapshot(matches); // best-effort; failures are swallowed
    return NextResponse.json({ matches, next }, { headers: HEALTHY });
  } catch (err) {
    if (snapshot && snapshot.ageSeconds <= SNAPSHOT_STALE_MAX_S) {
      return NextResponse.json(
        { matches: snapshot.matches, next, delayed: true, reason: "stale_snapshot" },
        { headers: NO_STORE },
      );
    }
    const message = err instanceof Error ? err.message : "unknown error";
    // Never leak the key or stack; just signal degradation.
    return NextResponse.json(
      { matches: [], delayed: true, reason: message.includes("FOOTBALL_API_KEY") ? "no_key" : "provider_error" },
      { status: 200, headers: NO_STORE },
    );
  }
}
