import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Neon (serverless Postgres) client for My Football Tracker.
 *
 * The app moved off Supabase (its free-tier project kept auto-pausing once the
 * two active-project slots were taken by other apps, which silently took the
 * raffle + match cache offline). Neon's free tier doesn't hard-pause — it
 * suspends idle compute and resumes on the next query — and it's a fine fit for
 * this app's light workload (a small raffle-leads table + two cache tables).
 *
 * Connection is server-side only via DATABASE_URL (the pooled Neon connection
 * string). The database is never exposed to the browser — only our route
 * handlers and server components query it — so there's no RLS/anon-key layer to
 * maintain, unlike Supabase's PostgREST. `db()` returns null when DATABASE_URL
 * is unset so every caller degrades gracefully instead of throwing.
 */

let cached: NeonQueryFunction<false, false> | null | undefined;

export function db(): NeonQueryFunction<false, false> | null {
  if (cached === undefined) {
    const url = process.env.DATABASE_URL;
    cached = url ? neon(url) : null;
  }
  return cached;
}

/** Guard any query so a slow/suspended database can never hang a page/request. */
export async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * The tables this app needs (mirrors db/schema.sql). Every statement is
 * `if not exists`: purely additive, never drops or alters existing data, so it's
 * safe to run on every cold start. This is what actually brings the Neon layer
 * online — the Vercel integration created an empty database, and until these
 * tables exist every live-snapshot / archive / feedback query fails.
 */
const SCHEMA: string[] = [
  `create table if not exists feedback (
    id         bigint generated always as identity primary key,
    message    text        not null,
    rating     smallint,
    email      text,
    page       text,
    session_id text,
    user_agent text,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists feedback_created_idx on feedback (created_at desc)`,
  `create table if not exists live_snapshot (
    id         smallint    primary key,
    matches    jsonb       not null,
    fetched_at timestamptz not null default now()
  )`,
  `create table if not exists match_archive (
    id             bigint      primary key,
    match          jsonb       not null,
    details        jsonb,
    status         text        not null,
    kickoff_utc    timestamptz,
    competition_id integer,
    updated_at     timestamptz not null default now()
  )`,
  `create index if not exists match_archive_kickoff_idx on match_archive (kickoff_utc desc)`,
  // Additive: which event-mapper version wrote the row (null = v1, before the
  // 2026-10-02 substitution fix). Rows are corrected on read, never rewritten.
  `alter table match_archive add column if not exists mapper_version smallint`,
];

let schemaReady: Promise<boolean> | null = null;

function ensureSchema(sql: NeonQueryFunction<false, false>): Promise<boolean> {
  schemaReady ??= (async () => {
    for (const stmt of SCHEMA) await sql.query(stmt);
    return true;
  })().catch((err) => {
    schemaReady = null; // retry on a later request
    console.warn("[db] schema setup failed:", err instanceof Error ? err.message : err);
    return false;
  });
  return schemaReady;
}

/**
 * The database client once its tables are guaranteed to exist, or null (no
 * DATABASE_URL, or setup failed / is slow). Callers treat null exactly like "no
 * database" and fall back to the provider, so a DB problem never blocks a page.
 */
export async function readyDb(timeoutMs = 3_000): Promise<NeonQueryFunction<false, false> | null> {
  const sql = db();
  if (!sql) return null;
  const ok = await withTimeout(ensureSchema(sql), timeoutMs, false);
  return ok ? sql : null;
}
