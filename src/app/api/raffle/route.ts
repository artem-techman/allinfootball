import { NextResponse } from "next/server";
import { swr } from "@/lib/cache";
import {
  RAFFLE_ID,
  isValidAge,
  isValidEmail,
  isValidName,
  isValidSpend,
  isValidTeam,
} from "@/lib/raffle/config";

/**
 * Messi-shirt raffle API.
 *   GET  /api/raffle → { count }  — total entries (a single aggregate number)
 *   POST /api/raffle {name, email, age, team, spend, sessionId} → { ok, already? }
 *
 * Entries hold PII (name + email), so the Supabase key stays server-side and RLS
 * is insert-only for anon — raw rows are readable from the dashboard only.
 * Duplicate emails come back as 409 from the unique constraint and are reported
 * as "already entered" rather than an error. Email verification (double opt-in)
 * is pre-wired in the schema but not yet enabled — entries start unverified.
 */
export const dynamic = "force-dynamic";

const COUNT_TTL = 60; // seconds

function supabase(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export async function GET() {
  const sb = supabase();
  if (!sb) return NextResponse.json({ count: 0 });
  try {
    const count = await swr("raffle:count", COUNT_TTL, async () => {
      const res = await fetch(`${sb.url}/rest/v1/rpc/raffle_entry_count`, {
        method: "POST",
        headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_raffle_id: RAFFLE_ID }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`raffle_entry_count ${res.status}`);
      return Number(await res.json()) || 0;
    });
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

export async function POST(request: Request) {
  const sb = supabase();
  if (!sb) return NextResponse.json({ ok: false }, { status: 503 });

  let body: {
    name?: string;
    email?: string;
    age?: string;
    team?: string;
    spend?: string;
    sessionId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const { name, email, age, team, spend, sessionId } = body;
  const validSession = typeof sessionId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(sessionId);
  if (
    !isValidName(name) ||
    !isValidEmail(email) ||
    !isValidAge(age) ||
    !isValidTeam(team) ||
    !isValidSpend(spend) ||
    !validSession
  ) {
    return NextResponse.json({ ok: false, error: "invalid entry" }, { status: 400 });
  }

  try {
    const res = await fetch(`${sb.url}/rest/v1/raffle_entries`, {
      method: "POST",
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        raffle_id: RAFFLE_ID,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        age_bracket: age,
        favourite_team: team.trim(),
        spend_bracket: spend,
        consent_marketing: true, // bundled consent, stated in the widget fine print
        session_id: sessionId,
      }),
      cache: "no-store",
    });
    // 409 = this email already entered — that's a success from the user's side.
    if (res.status === 409) return NextResponse.json({ ok: true, already: true });
    return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : 502 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
