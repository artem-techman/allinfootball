import "server-only";
import { cache, swr, TTL } from "@/lib/cache";
import { COMPETITIONS, getCompetitionByLeagueId, isInScope } from "@/lib/constants/competitions";
import { allowedSeasons, seasonYearFor } from "@/lib/season";
import { toDateKey } from "@/lib/utils/date";
import { getFixtureBundles, mergeLiveSources, type FixtureBundle } from "./apiFootball";
import type { FootballProvider, Match, Team, TeamFixturesOptions } from "./types";

/**
 * The scope guard — the ONLY way pages and routes reach the provider.
 *
 * Before 2026-10-02 every route forwarded whatever id, league, season or date it
 * was given straight to API-Football: one script walking fixture ids could spend
 * the whole daily quota and blank the site until midnight UTC. Now:
 *
 *  1. Allow-list. Our ten competitions' season fixture lists (current + previous
 *     season, refreshed every 30 min) define every fixture, team and date we
 *     serve. Anything outside costs ZERO provider calls and resolves to "not
 *     found" / empty.
 *  2. Most reads are answered from those lists with no extra call at all:
 *     dates, team fixtures, a team list per league, team search, and the match
 *     record itself.
 *  3. Live freshness comes from ONE batched `/fixtures?ids=` call covering every
 *     in-scope fixture inside its live window (90 min before kickoff → 200 min
 *     after). Score, events, lineups and stats for all of them, however many
 *     match pages fans have open — cost per refresh is flat.
 *  4. The global live feed is only polled while some in-scope fixture is in its
 *     window; on a day with nothing on, Live Now costs nothing.
 *
 * SCOPE_ENFORCE=0 bypasses the guard (emergency kill switch).
 */

const WINDOW_BEFORE_MS = 90 * 60_000; // lineups land ~1h before kickoff
const WINDOW_AFTER_MS = 200 * 60_000; // full time + extra time + penalties + delays
const ODDS_HORIZON_MS = 72 * 60 * 60_000;

const isLive = (m: Match) => m.status === "live" || m.status === "ht";
const isOver = (m: Match) => m.status !== "scheduled" && !isLive(m);

interface TeamEntry {
  team: Team;
  leagues: Set<number>;
}

interface ScopeIndex {
  fixtures: Map<number, Match>;
  teams: Map<number, TeamEntry>;
  /** league id → season → fixtures (in scope only). */
  byLeague: Map<number, Map<number, Match[]>>;
  /** UK date key → fixtures that day, kickoff order. Built ONCE per index:
   *  bucketing on every lookup cost ~460 ms (5,000 date formats) per call. */
  byDate: Map<string, Match[]>;
  /** team id → that team's fixtures. */
  byTeam: Map<number, Match[]>;
  /** Fixtures sorted by kickoff time, for fast live-window scans. */
  byKickoff: { ko: number; m: Match }[];
}

async function buildIndex(inner: FootballProvider): Promise<ScopeIndex> {
  const jobs = COMPETITIONS.flatMap((c) =>
    allowedSeasons(c).map((season) =>
      inner
        .getFixturesByLeague(c.leagueId, season)
        .then((list) => ({ league: c.leagueId, season, list, ok: true }))
        .catch(() => ({ league: c.leagueId, season, list: [] as Match[], ok: false })),
    ),
  );
  const results = await Promise.all(jobs);
  if (!results.some((r) => r.ok)) throw new Error("scope index: no fixture list could be loaded");

  const fixtures = new Map<number, Match>();
  const teams = new Map<number, TeamEntry>();
  const byLeague = new Map<number, Map<number, Match[]>>();
  for (const { league, season, list } of results) {
    const scoped = list.filter((m) => isInScope(m.competitionId, m.round));
    if (!byLeague.has(league)) byLeague.set(league, new Map());
    byLeague.get(league)!.set(season, scoped);
    for (const m of scoped) {
      fixtures.set(m.id, m);
      for (const t of [m.homeTeam, m.awayTeam]) {
        if (!t) continue;
        const entry = teams.get(t.id) ?? { team: t, leagues: new Set<number>() };
        entry.leagues.add(league);
        teams.set(t.id, entry);
      }
    }
  }
  const byDate = new Map<string, Match[]>();
  const byTeam = new Map<number, Match[]>();
  const byKickoff: { ko: number; m: Match }[] = [];
  for (const m of fixtures.values()) {
    const ko = Date.parse(m.kickoffUtc);
    if (!Number.isFinite(ko)) continue;
    byKickoff.push({ ko, m });
    const day = toDateKey(new Date(ko));
    (byDate.get(day) ?? byDate.set(day, []).get(day)!).push(m);
    for (const t of [m.homeTeamId, m.awayTeamId]) (byTeam.get(t) ?? byTeam.set(t, []).get(t)!).push(m);
  }
  byKickoff.sort((a, b) => a.ko - b.ko);
  for (const list of byDate.values()) list.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
  return { fixtures, teams, byLeague, byDate, byTeam, byKickoff };
}

/** In-scope fixtures inside their live window right now (by kickoff time). */
function windowFixtures(index: ScopeIndex, now = Date.now()): Match[] {
  // byKickoff is sorted: binary-search the first kickoff that can still be in
  // its window, then walk forward until kickoffs are too far ahead.
  const list = index.byKickoff;
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].ko < now - WINDOW_AFTER_MS) lo = mid + 1;
    else hi = mid;
  }
  const out: Match[] = [];
  for (let i = lo; i < list.length && list[i].ko - WINDOW_BEFORE_MS <= now; i += 1) {
    const m = list[i].m;
    if (m.status !== "postponed" && m.status !== "cancelled") out.push(m);
  }
  return out;
}

/** Simple per-instance token bucket for lookups we can't allow-list (players). */
function tokenBucket(perHour: number) {
  let tokens = perHour;
  let last = Date.now();
  return () => {
    const now = Date.now();
    tokens = Math.min(perHour, tokens + ((now - last) / 3_600_000) * perHour);
    last = now;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}

const TEAM_ALIASES: Record<string, string[]> = {
  spurs: ["tottenham"],
  "man utd": ["manchester united"],
  "man united": ["manchester united"],
  "man city": ["manchester city"],
  psg: ["paris saint germain"],
  barca: ["barcelona"],
  barça: ["barcelona"],
  atleti: ["atletico madrid"],
  juve: ["juventus"],
  inter: ["inter"],
  bayern: ["bayern munchen", "bayern münchen"],
  gladbach: ["borussia monchengladbach", "borussia mönchengladbach"],
  bvb: ["borussia dortmund"],
  wolves: ["wolves", "wolverhampton"],
  villa: ["aston villa"],
  forest: ["nottingham forest"],
  "la galaxy": ["los angeles galaxy", "la galaxy"],
};

/** Lowercase, strip accents and punctuation for forgiving name matching. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function guardProvider(inner: FootballProvider): FootballProvider {
  if (process.env.SCOPE_ENFORCE === "0") return inner;

  const index = () =>
    swr("scope:index", 5 * 60, () => buildIndex(inner));

  /** Fresh bundles for every fixture in its live window (one shared call). */
  async function windowBundles(idx: ScopeIndex): Promise<Map<number, FixtureBundle>> {
    const ids = windowFixtures(idx).map((m) => m.id);
    if (ids.length === 0) return new Map();
    return getFixtureBundles(ids).catch(() => new Map<number, FixtureBundle>());
  }

  /** Replace list records with fresher ones from the live window, when there are any. */
  async function overlay(idx: ScopeIndex, matches: Match[]): Promise<Match[]> {
    if (windowFixtures(idx).length === 0) return matches;
    const fresh = await windowBundles(idx);
    return matches.map((m) => fresh.get(m.id)?.match ?? m);
  }

  const playerBucket = tokenBucket(240);

  const guarded: FootballProvider = {
    name: `${inner.name}+scope`,

    getLeagues: () => inner.getLeagues(),
    getCurrentSeason: (id) => inner.getCurrentSeason(id),

    async getFixturesByDate(dateIso) {
      const idx = await index();
      return overlay(idx, idx.byDate.get(dateIso) ?? []);
    },

    async getFixturesByLeague(leagueId, season) {
      const comp = getCompetitionByLeagueId(leagueId);
      if (!comp || !allowedSeasons(comp).includes(season)) return [];
      const idx = await index();
      return overlay(idx, idx.byLeague.get(leagueId)?.get(season) ?? []);
    },

    async getLiveFixtures() {
      const idx = await index();
      if (windowFixtures(idx).length === 0) return []; // nothing of ours can be live
      const [liveAll, bundles] = await Promise.all([
        inner.getLiveFixtures().catch(() => null),
        windowBundles(idx),
      ]);
      if (liveAll == null && bundles.size === 0) throw new Error("live sources unavailable");
      return mergeLiveSources(liveAll ?? [], idx.fixtures, bundles);
    },

    async getMatch(id) {
      const idx = await index();
      const listed = idx.fixtures.get(id);
      if (!listed) return undefined; // out of scope: 0 calls, page 404s
      const inWindow = windowFixtures(idx).some((m) => m.id === id);
      if (inWindow) {
        const fresh = (await windowBundles(idx)).get(id)?.match;
        if (fresh) return fresh;
        return inner.getMatch(id).catch(() => listed);
      }
      // Outside the window the season list is accurate enough (refreshed every
      // 30 min; a match leaves the window 200 min after kickoff).
      return listed;
    },

    async getEvents(id) {
      const ctx = await detailContext(id);
      if (ctx.kind === "none") return [];
      if (ctx.kind === "window") return ctx.bundle?.events ?? inner.getEvents(id, TTL.live);
      return inner.getEvents(id);
    },

    async getLineups(id) {
      const ctx = await detailContext(id);
      if (ctx.kind === "none") return [];
      if (ctx.kind === "window") return ctx.bundle?.lineups ?? inner.getLineups(id, TTL.lineups);
      return inner.getLineups(id);
    },

    async getStatistics(id) {
      const ctx = await detailContext(id);
      if (ctx.kind === "none") return [];
      if (ctx.kind === "window") return ctx.bundle?.stats ?? inner.getStatistics(id, TTL.live);
      return inner.getStatistics(id);
    },

    async getStandings(leagueId, season) {
      const comp = getCompetitionByLeagueId(leagueId);
      if (!comp || !allowedSeasons(comp).includes(season)) return [];
      return inner.getStandings(leagueId, season);
    },

    async getTopScorers(leagueId, season) {
      const comp = getCompetitionByLeagueId(leagueId);
      if (!comp || !allowedSeasons(comp).includes(season)) return [];
      return inner.getTopScorers(leagueId, season);
    },

    async getTopAssists(leagueId, season) {
      const comp = getCompetitionByLeagueId(leagueId);
      if (!comp || !allowedSeasons(comp).includes(season)) return [];
      return inner.getTopAssists(leagueId, season);
    },

    async getHeadToHead(team1Id, team2Id, limit) {
      const idx = await index();
      if (!idx.teams.has(team1Id) || !idx.teams.has(team2Id)) return [];
      const rows = await inner.getHeadToHead(team1Id, team2Id, limit);
      // Old meetings may be outside our scope: render them as text, not dead links.
      return rows.map((m) => ({ ...m, linkable: idx.fixtures.has(m.id) }));
    },

    async getTeamFixtures(teamId, opts: TeamFixturesOptions) {
      const idx = await index();
      if (!idx.teams.has(teamId)) return [];
      const now = Date.now();
      const mine = idx.byTeam.get(teamId) ?? [];
      if (opts.last) {
        const past = mine
          .filter((m) => Date.parse(m.kickoffUtc) <= now && (isOver(m) || isLive(m)))
          .sort((a, b) => b.kickoffUtc.localeCompare(a.kickoffUtc))
          .slice(0, opts.last);
        return overlay(idx, past);
      }
      const next = mine
        .filter((m) => m.status === "scheduled" || isLive(m))
        .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc))
        .slice(0, opts.next ?? 8);
      return overlay(idx, next);
    },

    async getOdds(id) {
      const idx = await index();
      const m = idx.fixtures.get(id);
      if (!m || m.status !== "scheduled") return undefined;
      const toKickoff = Date.parse(m.kickoffUtc) - Date.now();
      if (toKickoff <= 0 || toKickoff > ODDS_HORIZON_MS) return undefined;
      return inner.getOdds(id);
    },

    async getTeam(teamId) {
      const idx = await index();
      return idx.teams.has(teamId) ? inner.getTeam(teamId) : undefined;
    },

    async getSquad(teamId) {
      const idx = await index();
      return idx.teams.has(teamId) ? inner.getSquad(teamId) : [];
    },

    async getTeamTransfers(teamId) {
      const idx = await index();
      return idx.teams.has(teamId) ? inner.getTeamTransfers(teamId) : [];
    },

    async getPlayer(playerId, season) {
      // Players can't be allow-listed without a squad call per team, so they're
      // rate-limited per instance instead, cached 6h, and shed early under quota
      // pressure ("detail" priority).
      const allowed = COMPETITIONS.some((c) => allowedSeasons(c).includes(season));
      if (!allowed) return undefined;
      // Only a real upstream fetch spends the rate limit, not a cache hit.
      const cached = cache.getStale(`player:${playerId}:${season}`) != null;
      if (!cached && !playerBucket()) return undefined;
      return inner.getPlayer(playerId, season);
    },

    getCoach: (id) => inner.getCoach(id),
    getVenue: (id) => inner.getVenue(id),

    async searchTeams(query) {
      const q = normalizeName(query);
      if (q.length < 2) return [];
      const idx = await index();
      const needles = [q, ...(TEAM_ALIASES[q] ?? []).map(normalizeName)];
      const hits: { team: Team; score: number }[] = [];
      for (const { team } of idx.teams.values()) {
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

    async getTeamsByLeague(leagueId, season) {
      const idx = await index();
      const list = idx.byLeague.get(leagueId)?.get(season) ?? [];
      const seen = new Map<number, Team>();
      for (const m of list) for (const t of [m.homeTeam, m.awayTeam]) if (t) seen.set(t.id, t);
      return [...seen.values()];
    },
  };

  type DetailContext =
    | { kind: "none" }
    | { kind: "window"; bundle?: FixtureBundle }
    | { kind: "past" };

  /** Where a fixture's detail should come from — or nowhere (0 calls). */
  async function detailContext(id: number): Promise<DetailContext> {
    const idx = await index();
    const m = idx.fixtures.get(id);
    if (!m) return { kind: "none" };
    if (windowFixtures(idx).some((w) => w.id === id)) {
      return { kind: "window", bundle: (await windowBundles(idx)).get(id) };
    }
    // Not yet in its window: nothing exists to fetch (no lineups, events or stats).
    if (Date.parse(m.kickoffUtc) > Date.now()) return { kind: "none" };
    return { kind: "past" };
  }

  return guarded;
}

/** Top scorers we already know of, for player search (current season, cached lists). */
export async function searchKnownPlayers(
  provider: FootballProvider,
  query: string,
): Promise<{ id: number; name: string; teamName?: string }[]> {
  const q = normalizeName(query);
  if (q.length < 3) return [];
  const lists = await Promise.all(
    COMPETITIONS.map((c) => provider.getTopScorers(c.leagueId, seasonYearFor(c)).catch(() => [])),
  );
  const seen = new Map<number, { id: number; name: string; teamName?: string }>();
  for (const list of lists) {
    for (const s of list) {
      const name = s.player?.name;
      if (!name || seen.has(s.playerId)) continue;
      const n = normalizeName(name);
      if (n.split(" ").some((w) => w.startsWith(q)) || n.includes(q)) {
        seen.set(s.playerId, { id: s.playerId, name, teamName: s.team?.name });
      }
    }
  }
  return [...seen.values()];
}
