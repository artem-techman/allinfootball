import "server-only";
import { COMPETITIONS, isInScope } from "@/lib/constants/competitions";
import { allowedSeasons, seasonYearFor } from "@/lib/season";
import { toDateKey, todayKey } from "@/lib/utils/date";
import { compareProgress } from "@/lib/utils/match";
import { ingestFetch, type FixtureBundle } from "@/lib/providers/apiFootball";
import { getJson, mgetJson, redis, type Redis } from "@/lib/store/redis";
import { FINAL_STATUSES, K, type FixtureDetail, type LiveSnapshot, type Stamped, type TeamEntry } from "@/lib/store/keys";
import type { Match } from "@/lib/providers/types";

/**
 * The ingest worker — the ONLY code that calls API-Football for match data.
 *
 * Runs every minute (Vercel cron → /api/cron/ingest), twice per run (≈30s apart),
 * and decides what to fetch from a fixed schedule, so the daily request count
 * depends on the fixture calendar, never on how many people visit:
 *
 *   in-play window (kicked off, not final)   every 30s   one batched call / 20 matches
 *   upcoming (kickoff within 90 min)         every 5 min one batched call (lineups)
 *   today's schedule (safety net)            every 10 min
 *   season fixture lists                     hourly (previous season: daily)
 *   tables                                   hourly, and ~2 min after a match in that league ends
 *   top scorers / assists                    every 2h / 6h
 *
 * Results go to Redis (see store/keys.ts). Each run is single-flight (lock), and
 * capped in provider calls so a slow provider can't run past the cron interval.
 */

const MIN = 60_000;
const IN_PLAY_EVERY = 25_000; // two passes per minute
const UPCOMING_EVERY = 5 * MIN;
const DATE_CHECK_EVERY = 10 * MIN;
const LIST_EVERY = 60 * MIN;
const PAST_LIST_EVERY = 24 * 60 * MIN;
const STANDINGS_EVERY = 60 * MIN;
const STANDINGS_AFTER_FINISH = 2 * MIN;
const SCORERS_EVERY = 2 * 60 * MIN;
const ASSISTS_EVERY = 6 * 60 * MIN;
const WINDOW_BEFORE = 90 * MIN;
const WINDOW_AFTER = 200 * MIN;
const MAX_CALLS_PER_PASS = 12;

export interface PassReport {
  calls: number;
  tasks: string[];
  inPlay: number;
  upcoming: number;
  errors: string[];
}

/** Which window fixtures need refreshing, by kickoff time. Pure, exported for tests. */
export function classifyWindow(fixtures: Match[], now: number): { inPlay: number[]; upcoming: number[] } {
  const inPlay: number[] = [];
  const upcoming: number[] = [];
  for (const m of fixtures) {
    if (FINAL_STATUSES.has(m.status)) continue;
    const ko = Date.parse(m.kickoffUtc);
    if (!Number.isFinite(ko) || ko - WINDOW_BEFORE > now || now > ko + WINDOW_AFTER) continue;
    if (ko <= now + 5 * MIN) inPlay.push(m.id);
    else upcoming.push(m.id);
  }
  return { inPlay, upcoming };
}

/** Should a fresh record replace the stored one? Never step backwards in a match;
 *  always accept a moved kickoff (reschedule). Pure, exported for tests. */
export function shouldReplace(stored: Match | null, fresh: Match): boolean {
  if (!stored) return true;
  if (stored.kickoffUtc !== fresh.kickoffUtc) return true;
  if (compareProgress(fresh, stored) < 0) return false;
  return JSON.stringify(stored) !== JSON.stringify(fresh);
}

/** Run one pass. `pass` 0 does the scheduled housekeeping; every pass refreshes in-play. */
export async function runIngestPass(pass: number): Promise<PassReport> {
  const r = redis();
  if (!r) throw new Error("store not configured (Upstash env vars missing)");
  const report: PassReport = { calls: 0, tasks: [], inPlay: 0, upcoming: 0, errors: [] };
  const now = Date.now();
  const meta = ((await r.cmd<string[] | null>("HGETALL", K.meta)) ?? []).reduce<Record<string, number>>(
    (acc, v, i, arr) => (i % 2 === 0 ? { ...acc, [v]: Number(arr[i + 1]) } : acc),
    {},
  );
  const due = (field: string, every: number) => now - (meta[field] ?? 0) >= every;
  const stamp: Record<string, number> = {};
  const budget = () => report.calls < MAX_CALLS_PER_PASS;
  const attempt = async (task: string, fn: () => Promise<void>) => {
    try {
      await fn();
      report.tasks.push(task);
    } catch (err) {
      report.errors.push(`${task}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // ---- live window --------------------------------------------------------
  const window = await windowFixtures(r, now);
  const { inPlay, upcoming } = classifyWindow(window, now);
  report.inPlay = inPlay.length;
  report.upcoming = upcoming.length;

  if (inPlay.length && due("inplay", IN_PLAY_EVERY)) {
    await attempt("inplay", async () => {
      report.calls += Math.ceil(inPlay.length / 20);
      const bundles = await ingestFetch.bundles(inPlay);
      await writeBundles(r, bundles, window, now);
      stamp.inplay = now;
    });
  } else if (!inPlay.length) {
    // Nothing in play: publish an empty live list (cheap, keeps "updatedAt" honest).
    const live = await getJson<LiveSnapshot>(r, K.live);
    if (!live || live.matches.length || now - live.updatedAt > 5 * MIN) {
      await r.cmd("SET", K.live, JSON.stringify({ matches: [], updatedAt: now } satisfies LiveSnapshot));
    }
  }

  if (pass === 0) {
    if (upcoming.length && due("upcoming", UPCOMING_EVERY) && budget()) {
      await attempt("upcoming", async () => {
        report.calls += Math.ceil(upcoming.length / 20);
        await writeBundles(r, await ingestFetch.bundles(upcoming), window, now);
        stamp.upcoming = now;
      });
    }

    if (due("datecheck", DATE_CHECK_EVERY) && budget()) {
      await attempt("datecheck", async () => {
        report.calls += 1;
        await dateCheck(r);
        stamp.datecheck = now;
      });
    }

    // Season lists: missing first, then stalest; at most a few per pass.
    const lists = COMPETITIONS.flatMap((c) =>
      allowedSeasons(c).map((season, i) => ({ league: c.leagueId, season, every: i === 0 ? LIST_EVERY : PAST_LIST_EVERY })),
    )
      .map((l) => ({ ...l, field: `list:${l.league}:${l.season}` }))
      .filter((l) => due(l.field, l.every))
      .sort((a, b) => (meta[a.field] ?? 0) - (meta[b.field] ?? 0))
      .slice(0, 3);
    for (const l of lists) {
      if (!budget()) break;
      await attempt(l.field, async () => {
        report.calls += 1;
        await writeSeasonList(r, l.league, l.season, await ingestFetch.seasonFixtures(l.league, l.season));
        stamp[l.field] = now;
      });
    }

    // Tables: hourly, or soon after a match in that competition finished.
    for (const c of COMPETITIONS) {
      if (!budget()) break;
      const season = seasonYearFor(c);
      const field = `standings:${c.leagueId}`;
      const finished = meta[`dirty:${c.leagueId}`] ?? 0;
      const afterFinish = finished > (meta[field] ?? 0) && now - finished >= STANDINGS_AFTER_FINISH;
      if (!afterFinish && !due(field, STANDINGS_EVERY)) continue;
      await attempt(field, async () => {
        report.calls += 1;
        const data = await ingestFetch.standings(c.leagueId, season);
        if (data.length) await r.cmd("SET", K.standings(c.leagueId, season), JSON.stringify({ data, updatedAt: now } satisfies Stamped<typeof data>));
        stamp[field] = now;
      });
    }

    for (const c of COMPETITIONS) {
      if (!budget()) break;
      const season = seasonYearFor(c);
      for (const [kind, every] of [["scorers", SCORERS_EVERY], ["assists", ASSISTS_EVERY]] as const) {
        const field = `${kind}:${c.leagueId}`;
        if (!due(field, every) || !budget()) continue;
        await attempt(field, async () => {
          report.calls += 1;
          const data = kind === "scorers" ? await ingestFetch.topScorers(c.leagueId, season) : await ingestFetch.topAssists(c.leagueId, season);
          if (data.length) {
            const key = kind === "scorers" ? K.scorers(c.leagueId, season) : K.assists(c.leagueId, season);
            await r.cmd("SET", key, JSON.stringify({ data, updatedAt: now } satisfies Stamped<typeof data>));
          }
          stamp[field] = now;
        });
      }
    }

    // Drop live details for fixtures that have left the window.
    if (due("cleanup", 5 * MIN)) {
      const keep = new Set([...inPlay, ...upcoming].map(String));
      const fields = (await r.cmd<string[]>("HKEYS", K.liveDetail)) ?? [];
      const drop = fields.filter((f) => !keep.has(f));
      if (drop.length) await r.cmd("HDEL", K.liveDetail, ...drop);
      stamp.cleanup = now;
    }
  }

  stamp.lastRun = now;
  const flat = Object.entries(stamp).flatMap(([k, v]) => [k, v]);
  await r.cmd("HSET", K.meta, ...flat);
  return report;
}

/* ------------------------------- helpers ---------------------------------- */

/** Fixtures that could be in their live window: yesterday, today and tomorrow (UK days). */
async function windowFixtures(r: Redis, now: number): Promise<Match[]> {
  const days = [-1, 0, 1].map((d) => toDateKey(new Date(now + d * 24 * 60 * MIN)));
  const dayKeys = days.flatMap((d) => COMPETITIONS.map((c) => K.day(d, c.leagueId)));
  const ids = (await mgetJson<number[]>(r, dayKeys)).flatMap((v) => v ?? []);
  const records = await mgetJson<Match>(r, ids.map(K.fx));
  return records.filter((m): m is Match => m != null);
}

/** Store fresh bundles: live list, per-fixture detail, fixture records, finals. */
async function writeBundles(r: Redis, bundles: FixtureBundle[], window: Match[], now: number): Promise<void> {
  const stored = new Map(window.map((m) => [m.id, m]));
  const cmds: (string | number)[][] = [];
  const detailFields: (string | number)[] = [];
  const liveMatches: Match[] = [];

  for (const b of bundles) {
    const m = b.match;
    const detail: FixtureDetail = { match: m, events: b.events, lineups: b.lineups, stats: b.stats, updatedAt: now };
    if (m.status === "live" || m.status === "ht") liveMatches.push(m);
    if (shouldReplace(stored.get(m.id) ?? null, m)) cmds.push(["SET", K.fx(m.id), JSON.stringify(m)]);
    if (FINAL_STATUSES.has(m.status)) {
      // Final: keep the full bundle permanently, retire it from the live hash,
      // and flag the competition's table for a refresh.
      if ((b.events?.length ?? 0) + (b.lineups?.length ?? 0) + (b.stats?.length ?? 0) > 0) {
        cmds.push(["SET", K.detail(m.id), JSON.stringify(detail)]);
      }
      cmds.push(["HDEL", K.liveDetail, String(m.id)]);
      if (!stored.get(m.id) || !FINAL_STATUSES.has(stored.get(m.id)!.status)) {
        cmds.push(["HSET", K.meta, `dirty:${m.competitionId}`, now]);
      }
    } else {
      detailFields.push(String(m.id), JSON.stringify(detail));
    }
  }
  if (detailFields.length) cmds.push(["HSET", K.liveDetail, ...detailFields]);

  // The live list only from the in-play pass (an upcoming-only batch has no live
  // matches and must not blank it).
  const fromInPlay = bundles.some((b) => Date.parse(b.match.kickoffUtc) <= now + 5 * MIN);
  if (fromInPlay) cmds.push(["SET", K.live, JSON.stringify({ matches: liveMatches, updatedAt: now } satisfies LiveSnapshot)]);
  await r.pipeline(cmds);
}

/** Safety net: today's full schedule catches reschedules, new fixtures and status
 *  changes the window logic didn't (e.g. a kickoff moved into today). */
async function dateCheck(r: Redis): Promise<void> {
  const today = todayKey();
  const fresh = (await ingestFetch.fixturesOnDate(today)).filter((m) => isInScope(m.competitionId, m.round));
  const stored = await mgetJson<Match>(r, fresh.map((m) => K.fx(m.id)));
  const cmds: (string | number)[][] = [];
  fresh.forEach((m, i) => {
    if (shouldReplace(stored[i], m)) cmds.push(["SET", K.fx(m.id), JSON.stringify(m)]);
  });
  // A fixture we've never seen (added since the last list refresh): index it
  // under its day so pages show it now; the hourly list refresh does the rest.
  for (const m of fresh.filter((_, i) => !stored[i])) {
    const key = K.day(toDateKey(new Date(m.kickoffUtc)), m.competitionId);
    const ids = (await getJson<number[]>(r, key)) ?? [];
    if (!ids.includes(m.id)) cmds.push(["SET", key, JSON.stringify([...ids, m.id])]);
  }
  await r.pipeline(cmds);
}

/** Store a season list: fixture records (never stepping backwards), and the
 *  day / league / team id indexes — writing only what changed. */
async function writeSeasonList(r: Redis, league: number, season: number, list: Match[]): Promise<void> {
  const scoped = list
    .filter((m) => isInScope(m.competitionId, m.round))
    .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
  if (scoped.length === 0) return; // never replace a good index with an empty answer

  const cmds: (string | number)[][] = [];

  // Fixture records.
  const stored = await mgetJson<Match>(r, scoped.map((m) => K.fx(m.id)));
  scoped.forEach((m, i) => {
    if (shouldReplace(stored[i], m)) cmds.push(["SET", K.fx(m.id), JSON.stringify(m)]);
  });

  // Day indexes (this league's share of each UK day), removing days it left.
  const byDay = new Map<string, number[]>();
  for (const m of scoped) {
    const d = toDateKey(new Date(m.kickoffUtc));
    (byDay.get(d) ?? byDay.set(d, []).get(d)!).push(m.id);
  }
  const prevDays = (await getJson<string[]>(r, K.leagueDays(league, season))) ?? [];
  const days = [...byDay.keys()];
  const existing = await mgetJson<number[]>(r, days.map((d) => K.day(d, league)));
  days.forEach((d, i) => {
    const ids = byDay.get(d)!;
    if (JSON.stringify(existing[i]) !== JSON.stringify(ids)) cmds.push(["SET", K.day(d, league), JSON.stringify(ids)]);
  });
  for (const d of prevDays) if (!byDay.has(d)) cmds.push(["DEL", K.day(d, league)]);
  if (JSON.stringify(prevDays) !== JSON.stringify(days)) cmds.push(["SET", K.leagueDays(league, season), JSON.stringify(days)]);

  // League season index.
  const ids = scoped.map((m) => m.id);
  const prevIds = await getJson<number[]>(r, K.league(league, season));
  if (JSON.stringify(prevIds) !== JSON.stringify(ids)) cmds.push(["SET", K.league(league, season), JSON.stringify(ids)]);

  // Team indexes + the team directory (search, team lists).
  const byTeam = new Map<number, number[]>();
  const teamFields: string[] = [];
  for (const m of scoped) {
    for (const t of [m.homeTeam, m.awayTeam]) {
      if (!t) continue;
      if (!byTeam.has(t.id)) {
        byTeam.set(t.id, []);
        teamFields.push(`${t.id}:${league}`, JSON.stringify({ team: t, league } satisfies TeamEntry));
      }
      byTeam.get(t.id)!.push(m.id);
    }
  }
  const teamIds = [...byTeam.keys()];
  const prevTeam = await mgetJson<number[]>(r, teamIds.map((t) => K.team(t, league, season)));
  teamIds.forEach((t, i) => {
    const list = byTeam.get(t)!;
    if (JSON.stringify(prevTeam[i]) !== JSON.stringify(list)) cmds.push(["SET", K.team(t, league, season), JSON.stringify(list)]);
  });
  if (teamFields.length) cmds.push(["HSET", K.teams, ...teamFields]);

  await r.pipeline(cmds);
}
