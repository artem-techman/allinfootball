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
  // Last-good provider data (season fixture lists, tables, scorers) so any
  // instance can still render when the provider is shed or down.
  // ---- accounts (email + one-time code), My Club, votes, matchday emails ----
  `create table if not exists users (
    id                 bigint generated always as identity primary key,
    email              text        not null unique,
    club_team_id       integer,
    club_team_name     text,
    club_crest         text,
    matchday_email     boolean     not null default true,
    unsubscribe_token  text        not null unique,
    created_at         timestamptz not null default now(),
    last_login_at      timestamptz
  )`,
  `create table if not exists login_codes (
    id           bigint generated always as identity primary key,
    email        text        not null,
    code_hash    text        not null,
    attempts     smallint    not null default 0,
    expires_at   timestamptz not null,
    consumed_at  timestamptz,
    created_at   timestamptz not null default now()
  )`,
  `create index if not exists login_codes_email_idx on login_codes (email, created_at desc)`,
  `create table if not exists sessions (
    token_hash  text        primary key,
    user_id     bigint      not null references users(id),
    created_at  timestamptz not null default now(),
    expires_at  timestamptz not null
  )`,
  `create table if not exists potm_votes (
    match_id    bigint      not null,
    voter       text        not null,
    player_id   integer     not null,
    player_name text        not null,
    team_id     integer     not null,
    created_at  timestamptz not null default now(),
    primary key (match_id, voter)
  )`,
  `create table if not exists email_log (
    user_id   bigint      not null references users(id),
    match_id  bigint      not null,
    kind      text        not null,
    sent_at   timestamptz not null default now(),
    primary key (user_id, match_id, kind)
  )`,
  // Telegram channel posts: one row per post key, claimed before sending.
  `create table if not exists telegram_posts (
    key         text        primary key,
    kind        text        not null,
    status      text        not null default 'claimed',
    attempts    smallint    not null default 1,
    message_id  bigint,
    detail      text,
    posted_at   timestamptz not null default now()
  )`,
  `create table if not exists provider_cache (
    key        text        primary key,
    body       jsonb       not null,
    fetched_at timestamptz not null default now()
  )`,
  // Pep (the AI CEO) reports what he's doing; /pep shows it live.
  `create table if not exists pep_activity (
    id      bigserial   primary key,
    at      timestamptz not null default now(),
    kind    text        not null,
    title   text        not null,
    detail  text,
    link    text
  )`,
  // Community chat on /pep: signed-in fans talk, Pep replies (and can hide abuse).
  `create table if not exists pep_chat (
    id        bigserial   primary key,
    at        timestamptz not null default now(),
    user_id   bigint,
    author    text        not null,
    role      text        not null default 'fan',
    body      text        not null,
    reply_to  bigint,
    hidden    boolean     not null default false
  )`,
  `create index if not exists pep_chat_user_at on pep_chat (user_id, at desc)`,
  `alter table users add column if not exists display_name text`,
  `create table if not exists pep_scoreboard (
    id               bigserial   primary key,
    at               timestamptz not null default now(),
    monthly_visitors integer     not null
  )`,
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
