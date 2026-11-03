import "server-only";
import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { readyDb } from "@/lib/db/neon";
import type { Club } from "@/lib/club";

/**
 * A record of every My Club choice (club_picks), so we know how many fans follow
 * which club, including fans who never sign in. Visitors are identified only by a
 * random id in a first-party cookie; signing in links their picks to the account.
 * Best-effort: a database problem never blocks picking a club.
 */

export const VISITOR_COOKIE = "mft_vid";

/** This browser's anonymous id, created on first use (route handlers only). */
export async function visitorId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(VISITOR_COOKIE)?.value;
  if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;
  const id = randomBytes(16).toString("base64url");
  jar.set(VISITOR_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 400 * 24 * 3600,
  });
  return id;
}

/** Two-letter country of the request (Vercel's edge header), if known. */
export async function requestCountry(): Promise<string | null> {
  const c = (await headers()).get("x-vercel-ip-country");
  return c && /^[A-Z]{2}$/.test(c) ? c : null;
}

/**
 * `pick` a new club, `clear` it, or `existing`: a club chosen before we kept
 * records, seen for the first time (logged once per visitor and club).
 */
export async function recordClubPick(action: "pick" | "clear" | "existing", club: Club | null, userId: number | null): Promise<void> {
  try {
    const [vid, country, sql] = await Promise.all([visitorId(), requestCountry(), readyDb(3_000)]);
    if (!sql) return;
    if (action === "existing") {
      const seen = (await sql`
        select 1 from club_picks where visitor_id = ${vid} and team_id = ${club?.id ?? null} limit 1
      `) as unknown[];
      if (seen.length) return;
    }
    await sql`
      insert into club_picks (visitor_id, user_id, team_id, team_name, action, country)
      values (${vid}, ${userId}, ${club?.id ?? null}, ${club?.name ?? null}, ${action}, ${country})
    `;
  } catch (err) {
    console.warn(`[club_picks] not recorded: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** On sign-in, attach this browser's earlier picks to the account. */
export async function linkVisitorPicks(userId: number): Promise<void> {
  try {
    const [vid, sql] = await Promise.all([visitorId(), readyDb(3_000)]);
    if (!sql) return;
    await sql`update club_picks set user_id = ${userId} where visitor_id = ${vid} and user_id is null`;
  } catch {
    /* best-effort */
  }
}
