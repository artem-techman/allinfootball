import { NextResponse } from "next/server";
import { provider } from "@/lib/providers";
import { readLiveSnapshot, writeLiveSnapshot } from "@/lib/db/matchStore";

/**
 * GET /api/live — live fixtures across the nine competitions.
 *
 * Reads the shared Supabase snapshot first: if it's fresher than the live TTL,
 * the request costs ZERO provider API calls no matter how many visitors are
 * polling (the snapshot is shared across all serverless instances). Only a
 * stale snapshot triggers one upstream refresh, which is written back for
 * everyone else. If the provider fails (outage, daily budget spent), we serve
 * the last-known snapshot for a bounded window — flagged `delayed` so the UI
 * shows its data-may-be-delayed banner — instead of an empty widget.
 * (CLAUDE.md section 10: degrade gracefully, never crash.)
 */
export const dynamic = "force-dynamic";

const SNAPSHOT_FRESH_S = 30; // matches TTL.live
const SNAPSHOT_STALE_MAX_S = 15 * 60; // outage window: serve last-known scores up to 15 min

export async function GET() {
  const snapshot = await readLiveSnapshot();
  if (snapshot && snapshot.ageSeconds <= SNAPSHOT_FRESH_S) {
    return NextResponse.json({ matches: snapshot.matches });
  }

  try {
    const matches = await provider.getLiveFixtures();
    await writeLiveSnapshot(matches); // best-effort; failures are swallowed
    return NextResponse.json({ matches });
  } catch (err) {
    if (snapshot && snapshot.ageSeconds <= SNAPSHOT_STALE_MAX_S) {
      return NextResponse.json({ matches: snapshot.matches, delayed: true, reason: "stale_snapshot" });
    }
    const message = err instanceof Error ? err.message : "unknown error";
    // Never leak the key or stack; just signal degradation.
    return NextResponse.json(
      { matches: [], delayed: true, reason: message.includes("FOOTBALL_API_KEY") ? "no_key" : "provider_error" },
      { status: 200 },
    );
  }
}
