import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { readPep, recordPep } from "@/lib/pep";
import { PEP_KINDS, parseStatus } from "@/lib/pep/model";

/**
 * GET  /api/pep — what Pep is doing (public; polled by /pep).
 * POST /api/pep — Pep reports an activity. Bearer PEP_STATUS_TOKEN only: a
 *   write-only key that can add lines to his own log and nothing else (no
 *   database, provider or deploy access).
 *
 *   { "kind": "posting", "title": "Posted the Chelsea 5–1 Bournemouth recap on Threads",
 *     "detail": "optional, ≤500 chars", "link": "https://… (our site or a social platform)",
 *     "monthlyVisitors": 3412 }   ← optional scoreboard update
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const state = await readPep();
  return NextResponse.json(state, { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" } });
}

function authorised(request: Request): boolean {
  const token = process.env.PEP_STATUS_TOKEN;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token || !given) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = parseStatus(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, kinds: Object.keys(PEP_KINDS) }, { status: 400 });
  const result = await recordPep(parsed.activity, parsed.monthlyVisitors);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.id, room: PEP_KINDS[parsed.activity.kind].room });
}
