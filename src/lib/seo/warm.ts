import "server-only";
import { provider } from "@/lib/providers";
import { COMPETITIONS } from "@/lib/constants/competitions";
import { seasonYearFor } from "@/lib/season";
import { ingestFetch } from "@/lib/providers/apiFootball";
import { archiveFinishedMatch, archivedIds } from "@/lib/db/matchStore";
import { lastGoodSavedAt, saveLastGood } from "@/lib/db/lastGood";
import type { Match } from "@/lib/providers/types";

/**
 * Keeps every page a search robot can open fully built from SAVED data, so
 * crawling costs nothing (robots never trigger provider requests — apiGet):
 *   archive   finished current-season matches, 20 per request (bundles)
 *   h2h       head-to-head for every fixture in the next 14 days, refreshed daily
 *   teams     team profile + squad, refreshed weekly
 * Each run is capped so it never competes with live data for the quota.
 */

const DAY = 24 * 3600_000;
const ARCHIVE_BATCHES_PER_RUN = 5; // ≤ 100 matches
const H2H_PER_RUN = 12;
const TEAMS_PER_RUN = 8; // 2 requests each

export interface WarmReport {
  archived: number;
  archivePending: number;
  h2hWarmed: number;
  h2hPending: number;
  teamsWarmed: number;
  teamsPending: number;
  calls: number;
  errors: string[];
}

export async function warmForCrawlers(): Promise<WarmReport> {
  const report: WarmReport = { archived: 0, archivePending: 0, h2hWarmed: 0, h2hPending: 0, teamsWarmed: 0, teamsPending: 0, calls: 0, errors: [] };
  const now = Date.now();
  const lists = await Promise.all(
    COMPETITIONS.map((c) => provider.getFixturesByLeague(c.leagueId, seasonYearFor(c)).catch(() => [] as Match[])),
  );
  const all = lists.flat();

  // 1. Archive finished matches (immutable) in batches of 20.
  try {
    const finished = all.filter((m) => m.status === "finished").map((m) => m.id);
    const done = await archivedIds(finished);
    // Matches the provider can't give complete detail for yet (goal events
    // missing) are parked for a week instead of being re-requested every run.
    const parked = await lastGoodSavedAt(finished.filter((id) => !done.has(id)).map((id) => `archiveskip:${id}`));
    const todo = finished.filter((id) => !done.has(id) && now - (parked.get(`archiveskip:${id}`) ?? 0) > 7 * DAY);
    report.archivePending = todo.length;
    for (let b = 0; b < ARCHIVE_BATCHES_PER_RUN && b * 20 < todo.length; b += 1) {
      const chunk = todo.slice(b * 20, b * 20 + 20);
      report.calls += 1;
      const bundles = await ingestFetch.bundles(chunk);
      for (const x of bundles) {
        if (x.match.status !== "finished") continue;
        await archiveFinishedMatch(x.match, { events: x.events ?? [], lineups: x.lineups ?? [], stats: x.stats ?? [], h2h: [] });
      }
      const nowDone = await archivedIds(chunk);
      report.archived += nowDone.size;
      for (const id of chunk) if (!nowDone.has(id)) await saveLastGood(`archiveskip:${id}`, 1);
    }
    report.archivePending = Math.max(0, report.archivePending - report.archived);
  } catch (err) {
    report.errors.push(`archive: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Head-to-head for the next 14 days (preview content on upcoming match pages).
  try {
    const upcoming = all.filter((m) => m.status === "scheduled" && Date.parse(m.kickoffUtc) - now < 14 * DAY && Date.parse(m.kickoffUtc) > now);
    const keyOf = (m: Match) => `h2h:${m.homeTeamId}:${m.awayTeamId}:5`;
    // A "checked" marker per pair: teams that have never met return nothing,
    // and an empty result isn't stored — the marker stops a daily re-request.
    const checkOf = (m: Match) => `h2hchecked:${m.homeTeamId}:${m.awayTeamId}`;
    const saved = await lastGoodSavedAt(upcoming.map(checkOf));
    const stale = upcoming.filter((m) => now - (saved.get(checkOf(m)) ?? 0) > DAY);
    report.h2hPending = stale.length;
    for (const m of stale.slice(0, H2H_PER_RUN)) {
      report.calls += 1;
      const rows = await provider.getHeadToHead(m.homeTeamId, m.awayTeamId, 5).catch(() => null);
      if (!rows) continue; // provider unavailable: try again next run
      // Save explicitly: a value served from memory wouldn't reach the database.
      if (rows.length) await saveLastGood(keyOf(m), rows);
      await saveLastGood(checkOf(m), 1);
      report.h2hWarmed += 1;
    }
  } catch (err) {
    report.errors.push(`h2h: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. Team profiles + squads, weekly.
  try {
    const teams = [...new Set(all.flatMap((m) => [m.homeTeamId, m.awayTeamId]))];
    const saved = await lastGoodSavedAt(teams.map((t) => `team:${t}`));
    const stale = teams.filter((t) => now - (saved.get(`team:${t}`) ?? 0) > 7 * DAY);
    report.teamsPending = stale.length;
    for (const t of stale.slice(0, TEAMS_PER_RUN)) {
      report.calls += 2;
      const [team, squad] = await Promise.all([provider.getTeam(t).catch(() => undefined), provider.getSquad(t).catch(() => [])]);
      if (team) await saveLastGood(`team:${t}`, team);
      if (squad.length) await saveLastGood(`squad:${t}`, squad);
      if (team) report.teamsWarmed += 1;
    }
  } catch (err) {
    report.errors.push(`teams: ${err instanceof Error ? err.message : String(err)}`);
  }
  return report;
}
