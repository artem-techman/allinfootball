import { NextResponse } from "next/server";
import { runIngestPass, type PassReport } from "@/lib/ingest";
import { redis } from "@/lib/store/redis";
import { K } from "@/lib/store/keys";

/**
 * GET /api/cron/ingest — the data worker, triggered every minute by Vercel Cron
 * (vercel.json). Runs pass 0 (in-play + scheduled housekeeping) immediately and
 * pass 1 (in-play only) ~30s later, so live matches refresh twice a minute.
 *
 * Only Vercel's scheduler can trigger it: it sends `Authorization: Bearer
 * $CRON_SECRET`. Single-flight via a Redis lock, so overlapping runs can't
 * double-spend the quota.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SECOND_PASS_AT_MS = 30_000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const r = redis();
  if (!r) return NextResponse.json({ error: "store not configured" }, { status: 503 });

  const started = Date.now();
  const got = await r.cmd<string | null>("SET", K.lock, String(started), "NX", "EX", 58);
  if (got !== "OK") return NextResponse.json({ skipped: "another run holds the lock" });

  const passes: PassReport[] = [];
  try {
    passes.push(await runIngestPass(0));
    const wait = SECOND_PASS_AT_MS - (Date.now() - started);
    if (wait > 0) await new Promise((res) => setTimeout(res, wait));
    passes.push(await runIngestPass(1));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err), passes },
      { status: 500 },
    );
  } finally {
    await r.cmd("DEL", K.lock).catch(() => {});
  }
  return NextResponse.json({ ms: Date.now() - started, passes });
}
