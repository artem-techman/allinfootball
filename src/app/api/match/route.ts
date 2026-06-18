import { NextResponse } from "next/server";
import { provider } from "@/lib/providers";

/**
 * GET /api/match?id=<fixtureId> — the live-changing match bundle (match, events,
 * lineups, stats). Used by the match center for client-side polling while a
 * fixture is live. Degrades to a `delayed` flag on provider failure; never
 * crashes (CLAUDE.md section 10).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  try {
    const [match, events, lineups, stats] = await Promise.all([
      provider.getMatch(id),
      provider.getEvents(id).catch(() => []),
      provider.getLineups(id).catch(() => []),
      provider.getStatistics(id).catch(() => []),
    ]);
    if (!match) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ match, events, lineups, stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { delayed: true, reason: message.includes("FOOTBALL_API_KEY") ? "no_key" : "provider_error" },
      { status: 200 },
    );
  }
}
