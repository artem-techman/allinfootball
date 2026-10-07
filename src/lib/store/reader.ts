import "server-only";
import { swr } from "@/lib/cache";
import { COMPETITIONS } from "@/lib/constants/competitions";
import { allowedSeasons } from "@/lib/season";
import { TEAM_ALIASES, normalizeName, tokenBucket } from "@/lib/providers/scoped";
import { getJson, mgetJson, redis, type Redis } from "./redis";
import { FINAL_STATUSES, K, type FixtureDetail, type LiveSnapshot, type Stamped, type TeamEntry } from "./keys";
import type { FootballProvider, Match, Standing, Team, TopScorer } from "@/lib/providers/types";

/**
 * The site's football data, read from the store the ingest worker fills —
 * never from the provider on a visitor's request. Every list is ids resolved
 * against one record per fixture, with the in-play list laid on top, so every
 * page shows the same score and minute.
 *
 * Reads are memoised per server instance for a few seconds (the store only
 * changes every 30s), which keeps Redis traffic tiny and pages fast.
 *
 * `fallback` (the scope-guarded provider) is used only while the store isn't
 * ready (first deploy, worker not yet run) or if Redis is unreachable — so the
 * site degrades to the old path instead of going blank.
 * `inner` (the raw adapter) serves on-demand detail — team profile, squad,
 * player, odds, head-to-head — after the store has confirmed the id is ours.
 */

const LIVE_STALE_MS = 3 * 60_000; // live list older than this → the worker has stopped

export function storeProvider(inner: FootballProvider, fallback: FootballProvider): FootballProvider {
  const playerBucket = tokenBucket(240);

  /** Run against the store when it's usable, else the fallback provider. */
  async function withStore<T>(read: (r: Redis) => Promise<T | undefined>, viaFallback: () => Promise<T>): Promise<T> {
    const r = redis();
    if (!r || !(await ready(r))) return viaFallback();
    try {
      const v = await read(r);
      return v === undefined ? viaFallback() : v;
    } catch {
      return viaFallback();
    }
  }

  const provider: FootballProvider = {
    name: "store",

    getLeagues: () => inner.getLeagues(),
    getCurrentSeason: (id) => inner.getCurrentSeason(id),

    getFixturesByDate: (date) =>
      withStore(
        async (r) => {
          const ids = (await memoMget<number[]>(r, COMPETITIONS.map((c) => K.day(date, c.leagueId)), 15)).flatMap((v) => v ?? []);
          return sortByKickoff(await resolve(r, ids));
        },
        () => fallback.getFixturesByDate(date),
      ),

    getFixturesByLeague: (league, season) =>
      withStore(
        async (r) => {
          const ids = await memoGet<number[]>(r, K.league(league, season), 30);
          return ids ? resolve(r, ids) : undefined;
        },
        () => fallback.getFixturesByLeague(league, season),
      ),

    getLiveFixtures: () =>
      withStore(
        async (r) => {
          const live = await liveSnapshot(r);
          // A stale live list means the worker isn't running: don't present it as live.
          if (!live || Date.now() - live.updatedAt > LIVE_STALE_MS) return undefined;
          return live.matches;
        },
        () => fallback.getLiveFixtures(),
      ),

    getMatch: (id) =>
      withStore(
        async (r) => {
          const [m] = await resolve(r, [id]);
          return m ?? null; // in a ready store, missing = not ours (404), not "ask the provider"
        },
        () => fallback.getMatch(id).then((m) => m ?? null),
      ).then((m) => m ?? undefined),

    getEvents: (id) => detail(id, (d) => d.events, () => inner.getEvents(id), () => fallback.getEvents(id)),
    getLineups: (id) => detail(id, (d) => d.lineups, () => inner.getLineups(id), () => fallback.getLineups(id)),
    getStatistics: (id) => detail(id, (d) => d.stats, () => inner.getStatistics(id), () => fallback.getStatistics(id)),

    getStandings: (league, season) =>
      withStore(
        async (r) => (await memoGet<Stamped<Standing[]>>(r, K.standings(league, season), 60))?.data,
        () => fallback.getStandings(league, season),
      ),

    getTopScorers: (league, season) =>
      withStore(
        async (r) => (await memoGet<Stamped<TopScorer[]>>(r, K.scorers(league, season), 120))?.data,
        () => fallback.getTopScorers(league, season),
      ),

    getTopAssists: (league, season) =>
      withStore(
        async (r) => (await memoGet<Stamped<TopScorer[]>>(r, K.assists(league, season), 120))?.data,
        () => fallback.getTopAssists(league, season),
      ),

    getTeamFixtures: (teamId, opts) =>
      withStore(
        async (r) => {
          const keys = COMPETITIONS.flatMap((c) => allowedSeasons(c).map((s) => K.team(teamId, c.leagueId, s)));
          const ids = (await memoMget<number[]>(r, keys, 30)).flatMap((v) => v ?? []);
          const now = Date.now();
          const all = sortByKickoff(await resolve(r, ids));
          if (opts.last) {
            return all
              .filter((m) => Date.parse(m.kickoffUtc) <= now && m.status !== "scheduled")
              .reverse()
              .slice(0, opts.last);
          }
          return all.filter((m) => m.status === "scheduled" || m.status === "live" || m.status === "ht").slice(0, opts.next ?? 8);
        },
        () => fallback.getTeamFixtures(teamId, opts),
      ),

    getTeam: (id) =>
      withStore(async (r) => ((await teamKnown(r, id)) ? (await inner.getTeam(id)) ?? null : null), () => fallback.getTeam(id).then((t) => t ?? null)).then(
        (t) => t ?? undefined,
      ),
    getSquad: (id) => withStore(async (r) => ((await teamKnown(r, id)) ? inner.getSquad(id) : []), () => fallback.getSquad(id)),
    getTeamTransfers: (id) =>
      withStore(async (r) => ((await teamKnown(r, id)) ? inner.getTeamTransfers(id) : []), () => fallback.getTeamTransfers(id)),

    getHeadToHead: (a, b, limit) =>
      withStore(
        async (r) => {
          if (!(await teamKnown(r, a)) || !(await teamKnown(r, b))) return [];
          const rows = await inner.getHeadToHead(a, b, limit);
          const known = await mgetJson<Match>(r, rows.map((m) => K.fx(m.id)));
          return rows.map((m, i) => ({ ...m, linkable: known[i] != null }));
        },
        () => fallback.getHeadToHead(a, b, limit),
      ),

    getOdds: (id) =>
      withStore(
        async (r) => {
          const [m] = await resolve(r, [id]);
          const toKickoff = m ? Date.parse(m.kickoffUtc) - Date.now() : -1;
          if (!m || m.status !== "scheduled" || toKickoff <= 0 || toKickoff > 72 * 3_600_000) return null;
          return (await inner.getOdds(id)) ?? null;
        },
        () => fallback.getOdds(id).then((o) => o ?? null),
      ).then((o) => o ?? undefined),

    async getPlayer(id, season) {
      if (!COMPETITIONS.some((c) => allowedSeasons(c).includes(season))) return undefined;
      if (!playerBucket()) return undefined;
      return inner.getPlayer(id, season);
    },

    getCoach: (id) => inner.getCoach(id),
    getVenue: (id) => inner.getVenue(id),

    searchTeams: (query) =>
      withStore(
        async (r) => {
          const q = normalizeName(query);
          if (q.length < 2) return [];
          const needles = [q, ...(TEAM_ALIASES[q] ?? []).map(normalizeName)];
          const hits: { team: Team; score: number }[] = [];
          for (const team of (await teamDirectory(r)).values()) {
            const name = normalizeName(team.name);
            let score = -1;
            for (const n of needles) {
              if (name === n) score = Math.max(score, 3);
              else if (name.startsWith(n)) score = Math.max(score, 2);
              else if (name.split(" ").some((w) => w.startsWith(n)) || name.includes(n)) score = Math.max(score, 1);
            }
            if (score >= 0) hits.push({ team, score });
          }
          return hits.sort((a, b) => b.score - a.score || a.team.name.localeCompare(b.team.name)).map((h) => h.team);
        },
        () => fallback.searchTeams(query),
      ),

    getTeamsByLeague: (league, season) =>
      withStore(
        async (r) => {
          const ids = await memoGet<number[]>(r, K.league(league, season), 30);
          if (!ids) return undefined;
          const seen = new Map<number, Team>();
          for (const m of await resolve(r, ids)) for (const t of [m.homeTeam, m.awayTeam]) if (t) seen.set(t.id, t);
          return [...seen.values()];
        },
        () => fallback.getTeamsByLeague(league, season),
      ),
  };

  /** Events/lineups/stats: the live hash while in its window, else the final record. */
  async function detail<T>(
    id: number,
    pick: (d: FixtureDetail) => T[] | undefined,
    viaInner: () => Promise<T[]>,
    viaFallback: () => Promise<T[]>,
  ): Promise<T[]> {
    return withStore(
      async (r) => {
        const live = await memo(`livedetail:${id}`, 10, async () => {
          const raw = await r.cmd<string | null>("HGET", K.liveDetail, String(id));
          return raw ? (JSON.parse(raw) as FixtureDetail) : null;
        });
        if (live && pick(live)) return pick(live);
        const final = await memoGet<FixtureDetail>(r, K.detail(id), 3600);
        if (final && pick(final)) return pick(final);
        const [m] = await resolve(r, [id]);
        if (!m) return []; // not ours
        // Nothing can exist yet for a fixture well before kickoff.
        if (m.status === "scheduled" && Date.parse(m.kickoffUtc) - Date.now() > 90 * 60_000) return [];
        // An older match the worker never had in its window: fetch on demand from
        // the adapter (cached; the match page archives it on first view).
        return viaInner();
      },
      viaFallback,
    );
  }

  return provider;
}

/* ------------------------------- reads ------------------------------------ */

/** Ids → fixture records, in-play list on top (fresher minute and score). */
async function resolve(r: Redis, ids: number[]): Promise<Match[]> {
  if (ids.length === 0) return [];
  const [records, live] = await Promise.all([memoMget<Match>(r, ids.map(K.fx), 15), liveSnapshot(r)]);
  const liveById = new Map((live?.matches ?? []).map((m) => [m.id, m]));
  const out: Match[] = [];
  records.forEach((m, i) => {
    const l = liveById.get(ids[i]);
    // A record that has already reached full time wins over an older live copy.
    if (l && !(m && FINAL_STATUSES.has(m.status))) out.push(l);
    else if (m) out.push(m);
  });
  return out;
}

function liveSnapshot(r: Redis): Promise<LiveSnapshot | null> {
  return memo("live", 5, () => getJson<LiveSnapshot>(r, K.live));
}

function sortByKickoff(list: Match[]): Match[] {
  return [...list].sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
}

/** The store is ready once the worker has loaded every current-season list. */
async function ready(r: Redis): Promise<boolean> {
  return memo("store:ready", 30, async () => {
    const fields = COMPETITIONS.map((c) => `list:${c.leagueId}:${allowedSeasons(c)[0]}`);
    const vals = await r.cmd<(string | null)[]>("HMGET", K.meta, ...fields);
    return vals.every((v) => v != null);
  }).catch(() => false);
}

async function teamDirectory(r: Redis): Promise<Map<number, Team>> {
  return memo("teams", 600, async () => {
    const flat = (await r.cmd<string[] | null>("HGETALL", K.teams)) ?? [];
    const out = new Map<number, Team>();
    for (let i = 1; i < flat.length; i += 2) {
      const e = JSON.parse(flat[i]) as TeamEntry;
      out.set(e.team.id, e.team);
    }
    return out;
  });
}

async function teamKnown(r: Redis, id: number): Promise<boolean> {
  return (await teamDirectory(r)).has(id);
}

/* ------------------------------- memo ------------------------------------- */

function memo<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  return swr(`store:${key}`, ttlSeconds, fetcher);
}

function memoGet<T>(r: Redis, key: string, ttlSeconds: number): Promise<T | null> {
  return memo(key, ttlSeconds, () => getJson<T>(r, key));
}

/** MGET with per-key memoisation: only keys not seen in the last `ttl` seconds hit Redis. */
async function memoMget<T>(r: Redis, keys: string[], ttlSeconds: number): Promise<(T | null)[]> {
  const joined = keys.join("|");
  return memo(`mget:${joined.length > 200 ? hash(joined) : joined}`, ttlSeconds, () => mgetJson<T>(r, keys));
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `${s.length}:${h >>> 0}`;
}

