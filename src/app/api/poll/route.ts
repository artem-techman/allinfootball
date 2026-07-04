import { NextResponse } from "next/server";
import { swr } from "@/lib/cache";
import { isValidVote } from "@/lib/poll/questions";

/**
 * Fan Pulse poll API.
 *   GET  /api/poll                 → { results: { [questionId]: { [optionId]: votes } } }
 *   POST /api/poll {questionId, optionId, sessionId} → { ok }
 *
 * Votes are anonymous (random client session id, no PII) and stored in Supabase.
 * The Supabase key stays server-side; RLS only allows inserts, and reads happen
 * through an aggregate-counts RPC — raw rows are never exposed. Degrades
 * gracefully when Supabase is unreachable (never crashes the widget).
 */
export const dynamic = "force-dynamic";

const RESULTS_TTL = 60; // seconds — aggregate results are not hot data

function supabase(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export async function GET() {
  const sb = supabase();
  if (!sb) return NextResponse.json({ results: {} });

  try {
    const results = await swr("poll:results", RESULTS_TTL, async () => {
      const res = await fetch(`${sb.url}/rest/v1/rpc/poll_results`, {
        method: "POST",
        headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}`, "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`poll_results ${res.status}`);
      const rows = (await res.json()) as { question_id: string; option_id: string; votes: number }[];
      const out: Record<string, Record<string, number>> = {};
      for (const r of rows) (out[r.question_id] ??= {})[r.option_id] = Number(r.votes);
      return out;
    });
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: {} });
  }
}

export async function POST(request: Request) {
  const sb = supabase();
  if (!sb) return NextResponse.json({ ok: false }, { status: 503 });

  let body: { questionId?: string; optionId?: string; sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const { questionId, optionId, sessionId } = body;
  // Session ids are client-generated randomness — enforce shape, nothing more.
  const validSession = typeof sessionId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(sessionId);
  if (!questionId || !optionId || !validSession || !isValidVote(questionId, optionId)) {
    return NextResponse.json({ ok: false, error: "invalid vote" }, { status: 400 });
  }

  try {
    // Plain insert; the unique (question_id, session_id) constraint enforces one
    // vote per question per session. A 409 (already voted) counts as success —
    // we intentionally avoid ON CONFLICT here because its arbiter check would
    // require a SELECT policy, and raw rows must stay unreadable to the anon key.
    const res = await fetch(`${sb.url}/rest/v1/poll_responses`, {
      method: "POST",
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ question_id: questionId, option_id: optionId, session_id: sessionId }),
      cache: "no-store",
    });
    const ok = res.ok || res.status === 409;
    return NextResponse.json({ ok }, { status: ok ? 200 : 502 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
