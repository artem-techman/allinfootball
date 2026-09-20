import "server-only";
import { cache as reactCache } from "react";
import { db, withTimeout } from "@/lib/db/neon";
import type { Lineup, Match, MatchEvent, MatchStats } from "@/lib/providers/types";

/**
 * Neon-backed football data store — the "own database" layer that decouples what
 * visitors see from the provider's daily quota (built after the 2026-07-10 quota
 * exhaustion took the whole site's data down; moved off Supabase 2026-09-20 when
 * its free-tier project kept auto-pausing).
 *
 * Two jobs:
 *  1. live_snapshot — a single shared row holding the latest live fixtures.
 *     Every /api/live request reads it first; only when it's stale does ONE
 *     request refresh upstream and write back. Shared across ALL instances
 *     (unlike a per-lambda memory cache), and it lets us serve last-known scores
 *     (flagged delayed) when the provider is down or the budget is spent.
 *  2. match_archive — finished matches are immutable, so their full detail bundle
 *     (events/lineups/stats/h2h) is written ONCE on first view after the final
 *     whistle and every later view is served from here with zero provider calls.
 *
 * Everything is best-effort: on any DB failure readers return null and writers
 * no-op, so the provider path still works without the DB. Every query is wrapped
 * in a short timeout so a slow/suspended database can never hang a page.
 */

const REQUEST_TIMEOUT_MS = 3_000;
const LIVE_SNAPSHOT_ID = 1;

export interface ArchivedDetails {
  events: MatchEvent[];
  lineups: Lineup[];
  stats: MatchStats[];
  h2h: Match[];
}

export interface ArchivedMatch {
  match: Match;
  details: ArchivedDetails | null;
}

/* --------------------------------- live snapshot --------------------------------- */

export async function readLiveSnapshot(): Promise<{ matches: Match[]; ageSeconds: number } | null> {
  const sql = db();
  if (!sql) return null;
  try {
    const rows = await withTimeout(
      sql`select matches, fetched_at from live_snapshot where id = ${LIVE_SNAPSHOT_ID}` as unknown as Promise<
        Array<{ matches: Match[]; fetched_at: string }>
      >,
      REQUEST_TIMEOUT_MS,
      [],
    );
    const row = rows[0];
    if (!row || !Array.isArray(row.matches)) return null;
    const ageSeconds = (Date.now() - new Date(row.fetched_at).getTime()) / 1000;
    return { matches: row.matches, ageSeconds };
  } catch {
    return null;
  }
}

export async function writeLiveSnapshot(matches: Match[]): Promise<void> {
  const sql = db();
  if (!sql) return;
  try {
    await withTimeout(
      sql`
        insert into live_snapshot (id, matches, fetched_at)
        values (${LIVE_SNAPSHOT_ID}, ${JSON.stringify(matches)}::jsonb, now())
        on conflict (id) do update
          set matches = excluded.matches, fetched_at = excluded.fetched_at
      ` as unknown as Promise<unknown>,
      REQUEST_TIMEOUT_MS,
      undefined,
    );
  } catch {
    /* best-effort */
  }
}

/* --------------------------------- match archive --------------------------------- */

/**
 * Read a match's archived row. react-cached so generateMetadata and the page
 * body share ONE DB round-trip per request.
 */
export const readArchivedMatch = reactCache(async (id: number): Promise<ArchivedMatch | null> => {
  const sql = db();
  if (!sql || !Number.isFinite(id)) return null;
  try {
    const rows = await withTimeout(
      sql`select match, details from match_archive where id = ${id}` as unknown as Promise<
        Array<{ match: Match; details: ArchivedDetails | null }>
      >,
      REQUEST_TIMEOUT_MS,
      [],
    );
    const row = rows[0];
    return row?.match ? { match: row.match, details: row.details ?? null } : null;
  } catch {
    return null;
  }
});

/**
 * Persist a finished match with its detail bundle (write-once; upsert keeps it
 * idempotent under concurrent first views). Callers must only pass finished
 * matches with a non-empty bundle — archiving an empty bundle (e.g. fetched
 * during a provider outage) would freeze the emptiness forever.
 */
export async function archiveFinishedMatch(match: Match, details: ArchivedDetails): Promise<void> {
  const sql = db();
  if (!sql || match.status !== "finished") return;
  const hasSubstance = details.events.length + details.lineups.length + details.stats.length > 0;
  if (!hasSubstance) return;
  try {
    await withTimeout(
      sql`
        insert into match_archive (id, match, details, status, kickoff_utc, competition_id, updated_at)
        values (
          ${match.id},
          ${JSON.stringify(match)}::jsonb,
          ${JSON.stringify(details)}::jsonb,
          ${match.status},
          ${match.kickoffUtc},
          ${match.competitionId},
          now()
        )
        on conflict (id) do update set
          match = excluded.match,
          details = excluded.details,
          status = excluded.status,
          updated_at = now()
      ` as unknown as Promise<unknown>,
      REQUEST_TIMEOUT_MS,
      undefined,
    );
  } catch {
    /* best-effort */
  }
}
