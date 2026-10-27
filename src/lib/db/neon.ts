import "server-only";
import { neon } from "@neondatabase/serverless";
import postgres from "postgres";

/**
 * Postgres client for My Football Tracker.
 *
 * History: Supabase (July) → Neon (Sept, free tier) → Supabase Pro (25 Oct
 * 2026). Neon's free plan caps compute at 100 CU-hours a month and our
 * once-a-minute jobs keep the database awake around the clock, so it ran out
 * mid-month (HTTP 402) and took tables, the archive and accounts offline.
 *
 * SUPABASE_DB_URL (the Supabase transaction-pooler URI) wins when set;
 * otherwise DATABASE_URL (Neon) is used. Both expose the same tiny surface:
 * a tagged-template query returning rows, plus .query() for raw DDL.
 * Server-side only; on Supabase every table has row-level security switched on
 * with no policies, so the public Data API (anon key) can't read or write them.
 * `db()` returns null when no URL is set so callers degrade gracefully.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Sql {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<any[]>;
  query(text: string, params?: unknown[]): Promise<any[]>;
}

let cached: Sql | null | undefined;

function fromSupabase(url: string): Sql {
  const pg = postgres(url, {
    prepare: false, // required by the transaction pooler
    max: 3,
    idle_timeout: 20,
    max_lifetime: 60 * 10, // recycle connections before the pooler drops them
    connect_timeout: 8,
    onnotice: () => {},
  });
  // A pooled TCP connection can die while Vercel keeps the function frozen; the
  // first query after that fails once. Retry connection-level failures once
  // (a fresh connection is opened automatically). Query errors are not retried.
  const retryOnce = async <T,>(run: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      const msg = err instanceof Error ? err.message : String(err);
      if (/CONNECT|ECONNRESET|EPIPE|ETIMEDOUT|CONNECTION_(CLOSED|ENDED|DESTROYED)|terminat/i.test(`${code} ${msg}`)) return run();
      throw err;
    }
  };
  const fn = ((strings: TemplateStringsArray, ...values: unknown[]) =>
    retryOnce(() => pg(strings, ...(values as any[])) as unknown as Promise<any[]>)) as unknown as Sql;
  fn.query = (text, params) => retryOnce(() => pg.unsafe(text, (params ?? []) as any[]) as unknown as Promise<any[]>);
  return fn;
}

function fromNeon(url: string): Sql {
  const n = neon(url);
  const fn = ((strings: TemplateStringsArray, ...values: unknown[]) => n(strings, ...values)) as unknown as Sql;
  fn.query = (text, params) => n.query(text, params as any[]) as unknown as Promise<any[]>;
  return fn;
}

export function db(): Sql | null {
  if (cached === undefined) {
    const supabase = process.env.SUPABASE_DB_URL;
    const neonUrl = process.env.DATABASE_URL;
    cached = supabase ? fromSupabase(supabase) : neonUrl ? fromNeon(neonUrl) : null;
  }
  return cached;
}

/** Which database is in use (private health check). */
export function dbProvider(): "supabase" | "neon" | "none" {
  return process.env.SUPABASE_DB_URL ? "supabase" : process.env.DATABASE_URL ? "neon" : "none";
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Guard any query so a slow/suspended database can never hang a page/request. */
export async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  // If the timeout wins, the query may still fail later: swallow that so it can
  // never surface as an unhandled rejection and take the request down.
  Promise.resolve(p).catch(() => {});
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
  // Lock every table away from Supabase's public Data API: RLS on, no policies.
  // Our server connects as the owner, which RLS doesn't restrict.
  `do $$ declare t text; begin
     for t in select tablename from pg_tables where schemaname = 'public' and tablename = any(array[
       'feedback','live_snapshot','match_archive','users','login_codes','sessions','potm_votes','email_log',
       'telegram_posts','provider_cache','pep_activity','pep_chat','pep_scoreboard','leads'])
     loop execute format('alter table public.%I enable row level security', t); end loop;
   end $$`,
];

let schemaReady: Promise<boolean> | null = null;
/** The last database setup error, for the private health check. */
export let lastDbError: string | null = null;

function ensureSchema(sql: Sql): Promise<boolean> {
  schemaReady ??= (async () => {
    for (const stmt of SCHEMA) await sql.query(stmt);
    lastDbError = null;
    return true;
  })().catch((err) => {
    schemaReady = null; // retry on a later request
    lastDbError = err instanceof Error ? err.message.slice(0, 300) : String(err);
    console.warn("[db] schema setup failed:", lastDbError);
    return false;
  });
  return schemaReady;
}

/**
 * The database client once its tables are guaranteed to exist, or null (no
 * DATABASE_URL, or setup failed / is slow). Callers treat null exactly like "no
 * database" and fall back to the provider, so a DB problem never blocks a page.
 */
export async function readyDb(timeoutMs = 3_000): Promise<Sql | null> {
  const sql = db();
  if (!sql) return null;
  const ok = await withTimeout(ensureSchema(sql), timeoutMs, false);
  return ok ? sql : null;
}
