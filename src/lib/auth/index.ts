import "server-only";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { readyDb } from "@/lib/db/neon";

/**
 * Passwordless accounts: an email address and a one-time 6-digit code.
 *
 *  - Codes are stored only as an HMAC (AUTH_SECRET), expire after 10 minutes,
 *    allow 5 attempts, and are rate-limited per address (one per 45s, five an hour).
 *  - A session is a random token in an httpOnly, Secure, SameSite=Lax cookie;
 *    the database keeps only its HMAC. Signing out expires it (nothing deleted).
 */

export const SESSION_COOKIE = "mft_session";
const SESSION_DAYS = 180;
const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;

export interface User {
  id: number;
  email: string;
  clubTeamId: number | null;
  clubTeamName: string | null;
  clubCrest: string | null;
  matchdayEmail: boolean;
  unsubscribeToken: string;
}

interface UserRow {
  id: string | number;
  email: string;
  club_team_id: number | null;
  club_team_name: string | null;
  club_crest: string | null;
  matchday_email: boolean;
  unsubscribe_token: string;
}

const toUser = (r: UserRow): User => ({
  id: Number(r.id),
  email: r.email,
  clubTeamId: r.club_team_id,
  clubTeamName: r.club_team_name,
  clubCrest: r.club_crest,
  matchdayEmail: r.matchday_email,
  unsubscribeToken: r.unsubscribe_token,
});

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is not set");
  return "dev-only-auth-secret";
}

export function hmac(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function equalHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

async function db() {
  const sql = await readyDb(5_000);
  if (!sql) throw new Error("database unavailable");
  return sql;
}

/** Issue a code for this address, or explain why not (rate limit). */
export async function createLoginCode(email: string): Promise<{ code: string } | { error: "too_soon" | "too_many" }> {
  const sql = await db();
  const recent = (await sql`
    select created_at from login_codes
    where email = ${email} and created_at > now() - interval '1 hour'
    order by created_at desc
  `) as { created_at: string }[];
  if (recent.length >= 5) return { error: "too_many" };
  if (recent[0] && Date.now() - new Date(recent[0].created_at).getTime() < 45_000) return { error: "too_soon" };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await sql`
    insert into login_codes (email, code_hash, expires_at)
    values (${email}, ${hmac(`${email}:${code}`)}, now() + ${`${CODE_TTL_MIN} minutes`}::interval)
  `;
  return { code };
}

/** Check a code; on success return the (created-if-new) user. */
export async function verifyLoginCode(email: string, code: string): Promise<User | { error: "invalid" | "expired" | "locked" }> {
  if (!/^\d{6}$/.test(code)) return { error: "invalid" };
  const sql = await db();
  const rows = (await sql`
    select id, code_hash, attempts, expires_at from login_codes
    where email = ${email} and consumed_at is null
    order by created_at desc limit 1
  `) as { id: number; code_hash: string; attempts: number; expires_at: string }[];
  const row = rows[0];
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return { error: "expired" };
  if (row.attempts >= MAX_ATTEMPTS) return { error: "locked" };
  if (!equalHex(row.code_hash, hmac(`${email}:${code}`))) {
    await sql`update login_codes set attempts = attempts + 1 where id = ${row.id}`;
    return { error: row.attempts + 1 >= MAX_ATTEMPTS ? "locked" : "invalid" };
  }
  await sql`update login_codes set consumed_at = now() where id = ${row.id}`;
  const users = (await sql`
    insert into users (email, unsubscribe_token, last_login_at)
    values (${email}, ${randomBytes(24).toString("base64url")}, now())
    on conflict (email) do update set last_login_at = now()
    returning *
  `) as UserRow[];
  return toUser(users[0]);
}

/** Start a session for this user and set the cookie (route handlers only). */
export async function startSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const sql = await db();
  await sql`
    insert into sessions (token_hash, user_id, expires_at)
    values (${hmac(token)}, ${userId}, now() + ${`${SESSION_DAYS} days`}::interval)
  `;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

/** The signed-in user, or null. */
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const sql = await db();
    const rows = (await sql`
      select u.* from sessions s join users u on u.id = s.user_id
      where s.token_hash = ${hmac(token)} and s.expires_at > now()
    `) as UserRow[];
    return rows[0] ? toUser(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const sql = await db();
      await sql`update sessions set expires_at = now() where token_hash = ${hmac(token)}`;
    } catch {
      /* the cookie is cleared regardless */
    }
  }
  jar.delete(SESSION_COOKIE);
}

export async function updateUser(
  id: number,
  patch: { club?: { id: number; name: string; crest?: string } | null; matchdayEmail?: boolean },
): Promise<User | null> {
  const sql = await db();
  if (patch.club !== undefined) {
    await sql`
      update users set club_team_id = ${patch.club?.id ?? null}, club_team_name = ${patch.club?.name ?? null},
        club_crest = ${patch.club?.crest ?? null}
      where id = ${id}
    `;
  }
  if (patch.matchdayEmail !== undefined) {
    await sql`update users set matchday_email = ${patch.matchdayEmail} where id = ${id}`;
  }
  const rows = (await sql`select * from users where id = ${id}`) as UserRow[];
  return rows[0] ? toUser(rows[0]) : null;
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  if (!token || token.length > 100) return false;
  const sql = await db();
  const rows = (await sql`
    update users set matchday_email = false where unsubscribe_token = ${token} returning id
  `) as { id: number }[];
  return rows.length > 0;
}

/** Only accept writes from our own pages. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
