import { NextResponse } from "next/server";
import { brownoutLevel } from "@/lib/providers/apiFootball";
import { readLiveSnapshot } from "@/lib/db/matchStore";
import { readyDb } from "@/lib/db/neon";

/**
 * GET /api/health — for an uptime monitor. Costs no provider quota (/status is
 * free). Public answer is coarse on purpose (exact quota numbers would help an
 * attacker time a drain): status ok | degraded | brownout | down. With
 * `?token=` matching HEALTH_TOKEN it adds usage, budget and snapshot age.
 * Returns 503 when the provider is closed or the database is unreachable, so a
 * plain HTTP monitor alerts without parsing anything.
 */
export const dynamic = "force-dynamic";

const LEVELS = ["ok", "shedding odds/H2H", "shedding team/player detail", "live scores only", "provider closed"];

export async function GET(request: Request) {
  const [brownout, sql, snapshot] = await Promise.all([
    brownoutLevel().catch(() => ({ level: 4, used: null, budget: 0 })),
    readyDb(3_000).catch(() => null),
    readLiveSnapshot().catch(() => null),
  ]);
  const db = sql != null;
  const status = brownout.level >= 4 || !db ? "down" : brownout.level >= 2 ? "brownout" : brownout.level === 1 ? "degraded" : "ok";

  const token = process.env.HEALTH_TOKEN;
  const authed = !!token && new URL(request.url).searchParams.get("token") === token;
  const body = {
    status,
    db,
    quota: LEVELS[brownout.level],
    ...(authed
      ? {
          used: brownout.used,
          budget: brownout.budget,
          liveSnapshotAgeSeconds: snapshot ? Math.round(snapshot.ageSeconds) : null,
        }
      : {}),
  };
  return NextResponse.json(body, {
    status: status === "down" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
