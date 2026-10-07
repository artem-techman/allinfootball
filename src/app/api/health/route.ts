import { NextResponse } from "next/server";
import { brownoutLevel } from "@/lib/providers/apiFootball";
import { readLiveSnapshot } from "@/lib/db/matchStore";
import { readyDb } from "@/lib/db/neon";
import { redis, getJson } from "@/lib/store/redis";
import { K, type LiveSnapshot } from "@/lib/store/keys";

/** The ingest worker's heartbeat: seconds since its last run and since the live
 *  list was written. null when the store isn't configured. */
async function workerStatus(): Promise<{ lastRunS: number | null; liveAgeS: number | null } | null> {
  const r = redis();
  if (!r) return null;
  try {
    const [lastRun, live] = await Promise.all([
      r.cmd<string | null>("HGET", K.meta, "lastRun"),
      getJson<LiveSnapshot>(r, K.live),
    ]);
    const age = (t: number | null | undefined) => (t ? Math.round((Date.now() - Number(t)) / 1000) : null);
    return { lastRunS: age(lastRun ? Number(lastRun) : null), liveAgeS: age(live?.updatedAt) };
  } catch {
    return { lastRunS: null, liveAgeS: null };
  }
}

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
  const [brownout, sql, snapshot, worker] = await Promise.all([
    brownoutLevel().catch(() => ({ level: 4, used: null, budget: 0 })),
    readyDb(3_000).catch(() => null),
    readLiveSnapshot().catch(() => null),
    workerStatus(),
  ]);
  const db = sql != null;
  // Once the site reads from the store, a worker that hasn't run for 3 minutes
  // means data is going stale: report "down" so the uptime monitor alerts.
  const storeMode = process.env.DATA_SOURCE === "store";
  const workerStalled = storeMode && (worker?.lastRunS == null || worker.lastRunS > 180);
  const status =
    brownout.level >= 4 || !db || workerStalled
      ? "down"
      : brownout.level >= 2
        ? "brownout"
        : brownout.level === 1
          ? "degraded"
          : "ok";

  const token = process.env.HEALTH_TOKEN;
  const authed = !!token && new URL(request.url).searchParams.get("token") === token;
  const body = {
    status,
    db,
    quota: LEVELS[brownout.level],
    source: storeMode ? "store" : "provider",
    workerLastRunSeconds: worker?.lastRunS ?? null,
    ...(authed
      ? {
          used: brownout.used,
          budget: brownout.budget,
          liveSnapshotAgeSeconds: snapshot ? Math.round(snapshot.ageSeconds) : null,
          storeLiveAgeSeconds: worker?.liveAgeS ?? null,
        }
      : {}),
  };
  return NextResponse.json(body, {
    status: status === "down" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
