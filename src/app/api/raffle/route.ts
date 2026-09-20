import { NextResponse } from "next/server";
import { swr } from "@/lib/cache";
import { db } from "@/lib/db/neon";
import {
  RAFFLE_ID,
  isValidAge,
  isValidEmail,
  isValidName,
  isValidSpend,
  isValidTeam,
} from "@/lib/raffle/config";

/**
 * Messi-shirt raffle API (Neon-backed).
 *   GET  /api/raffle → { count }  — total entries (a single aggregate number)
 *   POST /api/raffle {name, email, age, team, spend, sessionId} → { ok, already? }
 *
 * Entries hold PII (name + email), so the database is reached server-side only
 * (DATABASE_URL) and never exposed to the browser. A duplicate email hits the
 * unique (raffle_id, email) constraint — handled with `on conflict do nothing`
 * and reported as "already entered" rather than an error. Email verification
 * (double opt-in) is pre-wired in the schema but not yet enabled — entries start
 * unverified.
 */
export const dynamic = "force-dynamic";

const COUNT_TTL = 60; // seconds

export async function GET() {
  const sql = db();
  if (!sql) return NextResponse.json({ count: 0 });
  try {
    const count = await swr("raffle:count", COUNT_TTL, async () => {
      const rows = (await sql`
        select count(*)::int as n from raffle_entries where raffle_id = ${RAFFLE_ID}
      `) as Array<{ n: number }>;
      return rows[0]?.n ?? 0;
    });
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

export async function POST(request: Request) {
  const sql = db();
  if (!sql) return NextResponse.json({ ok: false }, { status: 503 });

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
    // `on conflict do nothing returning id`: a returned row means we inserted;
    // no row means this email already entered — a success from the user's side.
    const rows = (await sql`
      insert into raffle_entries
        (raffle_id, name, email, age_bracket, favourite_team, spend_bracket, consent_marketing, session_id)
      values (
        ${RAFFLE_ID},
        ${name.trim()},
        ${email.trim().toLowerCase()},
        ${age},
        ${team.trim()},
        ${spend},
        ${true},
        ${sessionId}
      )
      on conflict (raffle_id, email) do nothing
      returning id
    `) as Array<{ id: number }>;
    if (rows.length === 0) return NextResponse.json({ ok: true, already: true });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
