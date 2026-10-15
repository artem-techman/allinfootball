import "server-only";
import { provider } from "@/lib/providers";
import { COMPETITIONS, getCompetitionByLeagueId } from "@/lib/constants/competitions";
import { seasonYearFor } from "@/lib/season";
import { ingestFetch } from "@/lib/providers/apiFootball";
import { archiveFinishedMatch, archivedIds } from "@/lib/db/matchStore";
import { lastGoodSavedAt, saveLastGood, saveLastGoodMany } from "@/lib/db/lastGood";
import { playerSeason } from "@/lib/seo/players";
import { groupRounds, indexableRounds } from "@/lib/seo/rounds";
import { lastIndexNowStatus, submitToIndexNow } from "@/lib/seo/indexnow";
import sitemap from "@/app/sitemap";
import type { Match } from "@/lib/providers/types";

/**
 * Keeps every page a search robot can open fully built from SAVED data, so
 * crawling costs nothing (robots never trigger provider requests — apiGet):
 *   archive   finished current-season matches, 20 per request (bundles)
 *   h2h       head-to-head for every fixture in the next 14 days, refreshed daily
 *   teams     team profile + squad, refreshed weekly
 *   players   every club squad's season stats (player pages), after each of the
 *             team's matches and at least weekly — ~2 requests per team
 *   injuries  missing/doubtful players for the next 7 days' fixtures, 20 per
 *             request; every 3h inside 48h of kick-off, otherwise every 12h
 *   indexnow  pings Bing & co. when a page meaningfully changes (preview ready,
 *             result in, round complete) — the whole sitemap once at start
 * Each run is capped, and every call here is "extra" priority: the first thing
 * shed when the quota tightens, so it never competes with live data.
 */

const DAY = 24 * 3600_000;
const ARCHIVE_BATCHES_PER_RUN = 5; // ≤ 100 matches
const H2H_PER_RUN = 12;
const TEAMS_PER_RUN = 8; // 2 requests each
const PLAYER_TEAMS_PER_RUN = 6; // ~2 requests each
const INJURY_REQUESTS_PER_RUN = 3; // 20 fixtures each

export interface WarmReport {
  archived: number;
  archivePending: number;
  h2hWarmed: number;
  h2hPending: number;
  teamsWarmed: number;
  teamsPending: number;
  playerTeamsWarmed: number;
  playersSaved: number;
  playerTeamsPending: number;
  injuryFixturesWarmed: number;
  injuryFixturesPending: number;
  indexNowSubmitted: number;
  indexNowStatus?: string[];
  calls: number;
  errors: string[];
}

export async function warmForCrawlers(): Promise<WarmReport> {
  const report: WarmReport = { archived: 0, archivePending: 0, h2hWarmed: 0, h2hPending: 0, teamsWarmed: 0, teamsPending: 0, playerTeamsWarmed: 0, playersSaved: 0, playerTeamsPending: 0, injuryFixturesWarmed: 0, injuryFixturesPending: 0, indexNowSubmitted: 0, calls: 0, errors: [] };
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

  // 4. Player profiles, a whole club squad per ~2 requests. National teams are
  //    skipped: their listing carries international stats only and would
  //    overwrite a player's club season.
  try {
    const season = playerSeason();
    const national = new Set<number>();
    const lastPlayed = new Map<number, number>();
    for (const m of all) {
      if (getCompetitionByLeagueId(m.competitionId)?.type === "international") {
        national.add(m.homeTeamId);
        national.add(m.awayTeamId);
      }
      if (m.status !== "finished") continue;
      const end = Date.parse(m.kickoffUtc) + 2.5 * 3600_000; // stats settle after the whistle
      for (const t of [m.homeTeamId, m.awayTeamId]) lastPlayed.set(t, Math.max(lastPlayed.get(t) ?? 0, end));
    }
    const clubs = [...new Set(all.flatMap((m) => [m.homeTeamId, m.awayTeamId]))].filter((t) => !national.has(t));
    // v2: profiles now carry displayName — re-save the squads stored before it.
    const markerOf = (t: number) => `teamplayers2:${t}:${season}`;
    const saved = await lastGoodSavedAt(clubs.map(markerOf));
    const at = (t: number) => saved.get(markerOf(t)) ?? 0;
    const stale = clubs.filter((t) => now - at(t) > 7 * DAY || at(t) < (lastPlayed.get(t) ?? 0)).sort((a, b) => at(a) - at(b));
    report.playerTeamsPending = stale.length;
    await Promise.all(
      stale.slice(0, PLAYER_TEAMS_PER_RUN).map(async (t) => {
        const profiles = await ingestFetch.teamPlayers(t, season).catch(() => null);
        report.calls += profiles ? Math.max(1, Math.ceil(profiles.length / 20)) : 1;
        if (!profiles) return; // shed or failed: next run
        await saveLastGoodMany(profiles.map((p) => [`player:${p.player.id}:${season}`, p]));
        await saveLastGood(markerOf(t), 1);
        report.playerTeamsWarmed += 1;
        report.playersSaved += profiles.length;
      }),
    );
    report.playerTeamsPending = Math.max(0, report.playerTeamsPending - report.playerTeamsWarmed);
  } catch (err) {
    report.errors.push(`players: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 5. Injuries & suspensions for the next 7 days (team news on match previews).
  //    Saved as { rows } so "nobody missing" is stored too (bare [] never is).
  try {
    const soon = all.filter((m) => m.status === "scheduled" && Date.parse(m.kickoffUtc) > now && Date.parse(m.kickoffUtc) - now < 7 * DAY);
    const keyOf = (id: number) => `injuries:${id}`;
    const saved = await lastGoodSavedAt(soon.map((m) => keyOf(m.id)));
    const stale = soon
      .filter((m) => {
        const age = now - (saved.get(keyOf(m.id)) ?? 0);
        return Date.parse(m.kickoffUtc) - now < 2 * DAY ? age > 3 * 3600_000 : age > 12 * 3600_000;
      })
      .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc))
      .map((m) => m.id);
    report.injuryFixturesPending = stale.length;
    for (let i = 0; i < INJURY_REQUESTS_PER_RUN && i * 20 < stale.length; i += 1) {
      const chunk = stale.slice(i * 20, i * 20 + 20);
      report.calls += 1;
      const byFixture = await ingestFetch.injuries(chunk).catch((err) => {
        report.errors.push(`injuries: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      });
      if (!byFixture) break; // shed or failed: next run
      await saveLastGoodMany([...byFixture].map(([id, rows]) => [keyOf(id), { rows }]));
      report.injuryFixturesWarmed += byFixture.size;
    }
    report.injuryFixturesPending = Math.max(0, report.injuryFixturesPending - report.injuryFixturesWarmed);
  } catch (err) {
    report.errors.push(`injuries: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 6. IndexNow. Each (page, state) is announced once: a marker per event.
  try {
    report.indexNowSubmitted = await announceChanges(all, lists, now);
    if (lastIndexNowStatus.length) report.indexNowStatus = [...lastIndexNowStatus];
  } catch (err) {
    report.errors.push(`indexnow: ${err instanceof Error ? err.message : String(err)}`);
  }
  return report;
}

const SITE = "https://myfootballtracker.com";

async function announceChanges(all: Match[], lists: Match[][], now: number): Promise<number> {
  const events: { marker: string; urls: string[] }[] = [];

  // The whole sitemap, once (first run after launch).
  const bulk = "indexnow:bulk:v1";
  if (!(await lastGoodSavedAt([bulk])).has(bulk)) {
    const urls = (await sitemap()).map((e) => e.url);
    const accepted = await submitToIndexNow(urls);
    if (accepted) await saveLastGood(bulk, 1);
    return accepted;
  }

  for (const m of all) {
    const ko = Date.parse(m.kickoffUtc);
    const teams = [m.homeTeam?.slug, m.awayTeam?.slug].filter(Boolean) as string[];
    if (m.status === "finished" && now - ko < 12 * 3600_000) {
      events.push({ marker: `indexnow:m:${m.id}:ft`, urls: [`${SITE}/match/${m.slug}`, ...teams.map((t) => `${SITE}/team/${t}/results`)] });
    } else if (m.status === "scheduled" && ko > now && ko - now < 7 * DAY) {
      events.push({ marker: `indexnow:m:${m.id}:pre`, urls: [`${SITE}/match/${m.slug}`] });
    }
  }
  COMPETITIONS.forEach((c, i) => {
    for (const r of indexableRounds(groupRounds(c.slug, lists[i] ?? []))) {
      const url = `${SITE}/competition/${c.slug}/round/${r.slug}`;
      if (r.state === "complete" && now - Date.parse(r.endUtc) < 3 * DAY) events.push({ marker: `indexnow:r:${c.slug}:${r.slug}:done`, urls: [url, `${SITE}/competition/${c.slug}/table`] });
      if (r.state === "upcoming") events.push({ marker: `indexnow:r:${c.slug}:${r.slug}:pre`, urls: [url] });
    }
  });

  const seen = await lastGoodSavedAt(events.map((e) => e.marker));
  const fresh = events.filter((e) => !seen.has(e.marker));
  if (!fresh.length) return 0;
  const accepted = await submitToIndexNow(fresh.flatMap((e) => e.urls));
  if (accepted) await saveLastGoodMany(fresh.map((e) => [e.marker, 1]));
  return accepted;
}
