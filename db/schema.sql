-- My Football Tracker — Neon (Postgres) schema.
-- Run once against the Neon database (SQL editor or `psql "$DATABASE_URL" -f db/schema.sql`).
-- Mirrors the tables the app previously used on Supabase. No RLS: the DB is only
-- ever reached server-side via DATABASE_URL, never exposed to the browser.

-- Messi-shirt raffle leads (PII: name + email). One entry per email per raffle.
create table if not exists raffle_entries (
  id                bigint generated always as identity primary key,
  raffle_id         text        not null,
  name              text        not null,
  email             text        not null,
  age_bracket       text,
  favourite_team    text,
  spend_bracket     text,
  consent_marketing boolean     not null default false,
  session_id        text,
  email_verified    boolean     not null default false,
  verify_token      uuid        not null default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  unique (raffle_id, email)
);

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
