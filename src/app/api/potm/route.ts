import { NextResponse } from "next/server";
import { provider } from "@/lib/providers";
import { sameOrigin } from "@/lib/auth";
import { candidates, castVote, myVote, tallies, voteOpen, voterKey } from "@/lib/potm";
import { swr } from "@/lib/cache";

/**
 * GET  /api/potm?match=<id> → { open, candidates, tallies, myVote }
 * POST /api/potm { match, playerId } → records one vote per fan per match.
 */
export const dynamic = "force-dynamic";

/** Per-instance limiter: a handful of votes per IP per minute. */
const recent = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 60_000);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 5_000) recent.clear();
  return hits.length > 10;
}

async function load(matchId: number) {
  const match = await provider.getMatch(matchId).catch(() => undefined);
  if (!match || match.status !== "finished") return null;
  const list = await swr(`potm:cands:${matchId}`, 600, () => candidates(matchId));
  return { match, list };
}

export async function GET(request: Request) {
  const matchId = Number(new URL(request.url).searchParams.get("match"));
  if (!Number.isFinite(matchId)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const data = await load(matchId);
  if (!data) return NextResponse.json({ open: false, candidates: [], tallies: [], myVote: null });
  const voter = await voterKey(false);
  const [t, mine] = await Promise.all([tallies(matchId).catch(() => []), myVote(matchId, voter).catch(() => null)]);
  return NextResponse.json(
    { open: voteOpen(data.match), candidates: data.list, tallies: t, myVote: mine },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip)) return NextResponse.json({ error: "too_many" }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as { match?: unknown; playerId?: unknown };
  const matchId = Number(body.match);
  const playerId = Number(body.playerId);
  if (!Number.isFinite(matchId) || !Number.isFinite(playerId)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const data = await load(matchId);
  if (!data || !voteOpen(data.match)) return NextResponse.json({ error: "closed" }, { status: 400 });
  const pick = data.list.find((c) => c.playerId === playerId);
  if (!pick) return NextResponse.json({ error: "invalid_player" }, { status: 400 });
  const voter = await voterKey(true);
  try {
    const counted = await castVote(matchId, voter!, pick);
    return NextResponse.json({ ok: true, counted });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
