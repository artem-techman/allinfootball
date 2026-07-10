import "server-only";
import { cache as reactCache } from "react";
import type { Lineup, Match, MatchEvent, MatchStats } from "@/lib/providers/types";

/**
 * Supabase-backed football data store — the "own database" layer that decouples
 * what visitors see from the provider's daily quota (built after the 2026-07-10
 * quota exhaustion took the whole site's data down).
 *
 * Two jobs:
 *  1. live_snapshot — a single shared row holding the latest live fixtures.
 *     Every /api/live request reads it first; only when it's stale does ONE
 *     request refresh upstream and write back. Unlike per-lambda memory caches
 *     this is shared across ALL instances, and it lets us serve last-known
 *     scores (flagged as delayed) when the provider is down or the budget is
 *     spent — instead of an empty widget.
 *  2. match_archive — finished matches are immutable, so their full detail
 *     bundle (events/lineups/stats/h2h) is written ONCE on first view after
 *     the final whistle and every later view is served from here with zero
 *     provider API calls. This is what makes results from days/weeks ago free
 *     to browse.
 *
 * Everything here is best-effort: on any Supabase failure readers return null
 * and writers no-op, so the provider path still works without the DB. Requests
 * carry a short timeout so a slow DB can never hang a page.
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

function sb(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

async function rest(path: string, init: RequestInit = {}): Promise<Response | null> {
  const conn = sb();
  if (!conn) return null;
  try {
    return await fetch(`${conn.url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: conn.key,
        Authorization: `Bearer ${conn.key}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return null; // network/timeout — callers degrade to the provider path
  }
}

/* --------------------------------- live snapshot --------------------------------- */

export async function readLiveSnapshot(): Promise<{ matches: Match[]; ageSeconds: number } | null> {
  const res = await rest(`live_snapshot?id=eq.${LIVE_SNAPSHOT_ID}&select=matches,fetched_at`);
  if (!res?.ok) return null;
  try {
    const rows = (await res.json()) as Array<{ matches: Match[]; fetched_at: string }>;
    const row = rows[0];
    if (!row || !Array.isArray(row.matches)) return null;
    const ageSeconds = (Date.now() - new Date(row.fetched_at).getTime()) / 1000;
    return { matches: row.matches, ageSeconds };
  } catch {
    return null;
  }
}

export async function writeLiveSnapshot(matches: Match[]): Promise<void> {
  await rest("live_snapshot", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify([{ id: LIVE_SNAPSHOT_ID, matches, fetched_at: new Date().toISOString() }]),
  });
}

/* --------------------------------- match archive --------------------------------- */

/**
 * Read a match's archived row. react-cached so generateMetadata and the page
 * body share ONE Supabase round-trip per request.
 */
export const readArchivedMatch = reactCache(async (id: number): Promise<ArchivedMatch | null> => {
  if (!Number.isFinite(id)) return null;
  const res = await rest(`match_archive?id=eq.${id}&select=match,details`);
  if (!res?.ok) return null;
  try {
    const rows = (await res.json()) as Array<{ match: Match; details: ArchivedDetails | null }>;
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
  if (match.status !== "finished") return;
  const hasSubstance = details.events.length + details.lineups.length + details.stats.length > 0;
  if (!hasSubstance) return;
  await rest("match_archive", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify([
      {
        id: match.id,
        match,
        details,
        status: match.status,
        kickoff_utc: match.kickoffUtc,
        competition_id: match.competitionId,
        updated_at: new Date().toISOString(),
      },
    ]),
  });
}
