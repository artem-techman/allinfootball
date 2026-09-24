-- My Football Tracker — Neon (Postgres) schema.
-- Run once against the Neon database (SQL editor or `psql "$DATABASE_URL" -f db/schema.sql`).
-- Mirrors the tables the app previously used on Supabase. No RLS: the DB is only
-- ever reached server-side via DATABASE_URL, never exposed to the browser.

-- Site feedback (replaced the Messi-shirt raffle). Message required; rating and
-- email optional. No account required.
create table if not exists feedback (
  id         bigint generated always as identity primary key,
  message    text        not null,
  rating     smallint,               -- optional 1–5
  email      text,                    -- optional, for a reply
  page       text,                    -- where it was left from
  session_id text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_idx on feedback (created_at desc);

-- Shared live-fixtures snapshot: one row all serverless instances read/refresh.
create table if not exists live_snapshot (
  id         smallint    primary key,
  matches    jsonb       not null,
  fetched_at timestamptz not null default now()
);

-- Finished-match archive: immutable bundles written once, served with no API call.
create table if not exists match_archive (
  id             bigint      primary key,   -- API-Football fixture id
  match          jsonb       not null,
  details        jsonb,                     -- { events, lineups, stats, h2h }
  status         text        not null,
  kickoff_utc    timestamptz,
  competition_id integer,
  updated_at     timestamptz not null default now()
);

create index if not exists match_archive_kickoff_idx on match_archive (kickoff_utc desc);
