import "server-only";

import { swr, TTL } from "@/lib/cache";
import {
  COMPETITIONS,
  getCompetitionByLeagueId,
} from "@/lib/constants/competitions";
import { entitySlug } from "@/lib/utils/slug";
import { todayKey, shiftDateKey } from "@/lib/utils/date";
import { mapStatus } from "./statusMap";
import type {
  Competition,
  FootballProvider,
  Lineup,
  LineupPlayer,
  Match,
  MatchEvent,
  MatchEventType,
  MatchStats,
  Odds,
  Player,
  PlayerProfile,
  Season,
  Standing,
  Team,
  TeamFixturesOptions,
  TeamProfile,
  TopScorer,
  Coach,
  Venue,
} from "./types";

/**
 * API-Football adapter (CLAUDE.md section 5). The single place that understands
 * the provider's JSON. Everything else consumes domain types from ./types.
 *
 * KEY HANDLING: FOOTBALL_API_KEY is read from process.env at call time, sent as
 * the `x-apisports-key` header, and NEVER logged, returned, or shipped to the
 * client. This module is marked "server-only".
 *
 * The mapXxx() functions are pure and exported for unit testing against recorded
 * sample JSON (src/test). This is the highest-risk code in the app.
 */

const BASE_URL = "https://v3.football.api-sports.io";

/* ----------------------------- raw provider shapes ----------------------------- */
/* Only the fields we read are typed; the provider returns much more. */

interface RawPaging {
  current: number;
  total: number;
}
interface RawEnvelope<T> {
  response: T[];
  paging?: RawPaging;
  results?: number;
  errors?: unknown;
}

interface RawTeam {
  id: number;
  name: string;
  logo?: string;
  winner?: boolean | null;
}
interface RawFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null };
    venue?: { id: number | null; name?: string | null; city?: string | null };
    referee?: string | null;
  };
  league: { id: number; season: number; round?: string };
  teams: { home: RawTeam; away: RawTeam };
  goals: { home: number | null; away: number | null };
  score?: { penalty?: { home: number | null; away: number | null } };
}

/* ------------------------------- fetch plumbing ------------------------------- */

function requireKey(): string {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) {
    throw new Error(
      "FOOTBALL_API_KEY is not set. Add it to .env.local (server-side only).",
    );
  }
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Soft daily ceiling, kept below the real plan limit (7,500). It's the hard
 * guarantee that we never exhaust the quota: once today's authoritative usage
 * reaches this, the adapter stops calling the provider and serves cached/empty
 * data instead — no matter what drives traffic (bots, bugs, spikes). Tune via
 * FOOTBALL_DAILY_BUDGET.
 */
const DAILY_BUDGET = Number(process.env.FOOTBALL_DAILY_BUDGET) || 7000;
let budgetWarned = false;

/**
 * Today's request count from API-Football's own `/status` — which is FREE (it
 * does not count against the quota). Cached 60s in the shared data cache, so it
 * costs ~1 free call/min across the whole fleet and gives a near-real-time,
 * infra-free usage signal. Returns null if it can't be read (then we fail open).
 */
async function dailyRequestsUsed(): Promise<number | null> {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${BASE_URL}/status`, {
      headers: { "x-apisports-key": key },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { response?: { requests?: { current?: number } } };
    const current = data.response?.requests?.current;
    return typeof current === "number" ? current : null;
  } catch {
    return null;
  }
}

/**
 * GET an endpoint with exponential backoff + jitter on 429/5xx (section 10).
 * Throws on exhausted retries; the swr() layer serves last-good cache on throw.
 * Refuses to call the provider once the daily budget is reached (circuit breaker).
 */
async function apiGet<T>(
  path: string,
  params: Record<string, string | number> = {},
  opts: { revalidate?: number; maxRetries?: number } = {},
): Promise<RawEnvelope<T>> {
  // maxRetries defaults to 1 (was 3): a 429 means we're at the per-minute rate
  // limit, and retrying multiplies requests against the daily quota. One short
  // retry is enough; the swr() layer serves last-good cache on a hard failure.
  const { revalidate, maxRetries = 1 } = opts;
  const key = requireKey();

  // Circuit breaker: stop before we burn the real quota.
  const used = await dailyRequestsUsed();
  if (used != null && used >= DAILY_BUDGET) {
    if (!budgetWarned) {
      console.warn(`[apiFootball] daily budget reached (${used}/${DAILY_BUDGET}) — serving cached/empty until reset`);
      budgetWarned = true;
    }
    throw new Error(`API-Football daily budget reached (${used}/${DAILY_BUDGET})`);
  }

  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetch(url, {
      headers: { "x-apisports-key": key },
      // Durable, cross-instance caching via Next's data cache. Unlike the
      // in-memory swr() map (which is per-lambda and lost on cold start), this
      // is shared across all serverless invocations, so concurrent requests and
      // cold starts reuse one provider response per `revalidate` window instead
      // of each re-hitting the API. Falls back to no-store when no TTL is given.
      ...(revalidate != null ? { next: { revalidate } } : { cache: "no-store" as const }),
    });

    if (res.ok) {
      const env = (await res.json()) as RawEnvelope<T>;
      // API-Football returns HTTP 200 with a populated `errors` object on
      // application-level failures (bad params, rate limit, etc.). Treat those
      // as errors instead of silently yielding an empty response.
      const errs = env.errors;
      const hasErrors = Array.isArray(errs)
        ? errs.length > 0
        : errs != null && typeof errs === "object" && Object.keys(errs).length > 0;
      if (hasErrors) {
        throw new Error(`API-Football ${path} error: ${JSON.stringify(errs)}`);
      }
      return env;
    }

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= maxRetries) {
      throw new Error(`API-Football ${path} failed: ${res.status}`);
    }
    const backoff = Math.min(2000 * 2 ** attempt, 8000);
    const jitter = Math.random() * 250;
    await sleep(backoff + jitter);
    attempt += 1;
  }
}

/**
 * Read every page of a genuinely paginated endpoint (e.g. the full /players list
 * at 25/page — CLAUDE.md section 5). NOTE: /players/topscorers and topassists are
 * NOT paginated and reject a `page` param, so they use apiGet directly.
 */
export async function apiGetAll<T>(
  path: string,
  params: Record<string, string | number> = {},
  revalidate?: number,
): Promise<T[]> {
  const first = await apiGet<T>(path, { ...params, page: 1 }, { revalidate });
  const out = [...first.response];
  const total = first.paging?.total ?? 1;
  for (let page = 2; page <= total; page += 1) {
    const next = await apiGet<T>(path, { ...params, page }, { revalidate });
    out.push(...next.response);
  }
  return out;
}

/* --------------------------------- mappers --------------------------------- */

export function mapTeam(raw: RawTeam): Team {
  return {
    id: raw.id,
    slug: entitySlug(raw.name, raw.id),
    name: raw.name,
    crest: raw.logo,
  };
}

export function mapFixture(raw: RawFixture): Match {
  const status = mapStatus(raw.fixture.status.short);
  const comp = getCompetitionByLeagueId(raw.league.id);
  const home = mapTeam(raw.teams.home);
  const away = mapTeam(raw.teams.away);
  // Only surface a minute for in-play matches; never for scheduled/finished/etc.
  const inPlay = status === "live";
  return {
    id: raw.fixture.id,
    slug: entitySlug(`${raw.teams.home.name}-${raw.teams.away.name}`, raw.fixture.id),
    competitionId: raw.league.id,
    seasonYear: raw.league.season,
    round: raw.league.round,
    kickoffUtc: raw.fixture.date,
    status,
    minute: inPlay && raw.fixture.status.elapsed != null ? raw.fixture.status.elapsed : undefined,
    homeTeamId: home.id,
    awayTeamId: away.id,
    homeScore: raw.goals.home ?? undefined,
    awayScore: raw.goals.away ?? undefined,
    homePenalty: raw.score?.penalty?.home ?? undefined,
    awayPenalty: raw.score?.penalty?.away ?? undefined,
    // The provider flags the overall winner (after extra time / penalties), which
    // is more reliable than comparing the level regulation score of a shootout.
    winnerTeamId:
      raw.teams.home.winner === true ? home.id : raw.teams.away.winner === true ? away.id : undefined,
    venueId: raw.fixture.venue?.id ?? undefined,
    venueName: raw.fixture.venue?.name ?? undefined,
    city: raw.fixture.venue?.city ?? undefined,
    refereeName: raw.fixture.referee ?? undefined,
    refereeId: undefined,
    homeTeam: home,
    awayTeam: away,
    competition: comp
      ? { id: comp.leagueId, slug: comp.slug, name: comp.name }
      : { id: raw.league.id, slug: String(raw.league.id), name: String(raw.league.id) },
  };
}

interface RawEvent {
  time: { elapsed: number | null; extra: number | null };
  team: { id: number };
  player: { id: number | null; name?: string };
  assist?: { id: number | null; name?: string };
  type: string; // "Goal" | "Card" | "subst" | "Var"
  detail: string;
}

const EVENT_DETAIL_MAP: Record<string, MatchEventType> = {
  "Normal Goal": "goal",
  "Own Goal": "own_goal",
  Penalty: "penalty",
  "Missed Penalty": "missed_penalty",
  "Yellow Card": "yellow",
  "Red Card": "red",
  "Second Yellow card": "red",
};

export function mapEvent(raw: RawEvent, matchId: number, index: number): MatchEvent {
  let type: MatchEventType;
  if (raw.type === "subst") type = "sub";
  else if (raw.type === "Var") type = "var";
  else type = EVENT_DETAIL_MAP[raw.detail] ?? (raw.type === "Goal" ? "goal" : "var");

  return {
    id: `${matchId}-${index}`,
    matchId,
    minute: raw.time.elapsed ?? 0,
    extraMinute: raw.time.extra ?? undefined,
    type,
    teamId: raw.team.id,
    playerId: raw.player?.id ?? undefined,
    playerName: raw.player?.name ?? undefined,
    relatedPlayerId: raw.assist?.id ?? undefined,
    relatedPlayerName: raw.assist?.name ?? undefined,
    detail: raw.detail,
  };
}

interface RawLineup {
  team: { id: number };
  formation?: string | null;
  startXI: { player: RawLineupPlayer }[];
  substitutes: { player: RawLineupPlayer }[];
  coach?: { name?: string };
}
interface RawLineupPlayer {
  id: number | null;
  name: string;
  number?: number | null;
  pos?: string | null;
  grid?: string | null; // "row:col"
}

function mapLineupPlayer(p: RawLineupPlayer): LineupPlayer {
  const [row, col] = (p.grid ?? "").split(":").map((n) => Number(n));
  return {
    playerId: p.id ?? 0,
    name: p.name,
    number: p.number ?? undefined,
    position: p.pos ?? undefined,
    gridRow: Number.isFinite(row) ? row : undefined,
    gridCol: Number.isFinite(col) ? col : undefined,
  };
}

export function mapLineup(raw: RawLineup, matchId: number): Lineup {
  return {
    matchId,
    teamId: raw.team.id,
    formation: raw.formation ?? undefined,
    starters: raw.startXI.map((s) => mapLineupPlayer(s.player)),
    bench: raw.substitutes.map((s) => mapLineupPlayer(s.player)),
    coachName: raw.coach?.name,
  };
}

interface RawStatistics {
  team: { id: number };
  statistics: { type: string; value: number | string | null }[];
}

/** Parse "55%" -> 55, "12" -> 12, null -> undefined. */
function parseStat(value: number | string | null): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") return value;
  const cleaned = value.replace("%", "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

export function mapStatistics(raw: RawStatistics, matchId: number): MatchStats {
  const get = (type: string) =>
    parseStat(raw.statistics.find((s) => s.type === type)?.value ?? null);
  return {
    matchId,
    teamId: raw.team.id,
    shots: get("Total Shots"),
    sot: get("Shots on Goal"),
    possession: get("Ball Possession"),
    passes: get("Total passes"),
    passAccuracy: get("Passes %"),
    saves: get("Goalkeeper Saves"),
    corners: get("Corner Kicks"),
    fouls: get("Fouls"),
    offsides: get("Offsides"),
    yellow: get("Yellow Cards"),
    red: get("Red Cards"),
    shotsInBox: get("Shots insidebox"),
    shotsOutBox: get("Shots outsidebox"),
    blocked: get("Blocked Shots"),
    xg: get("expected_goals"),
    xgot: get("goals_prevented"),
  };
}

interface RawStandingRow {
  rank: number;
  team: RawTeam;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
  goalsDiff: number;
  points: number;
  form?: string | null;
  group?: string | null;
}

export function mapStandingRow(
  raw: RawStandingRow,
  leagueId: number,
  season: number,
): Standing {
  const form = (raw.form ?? "")
    .split("")
    .filter((c): c is "W" | "D" | "L" => c === "W" || c === "D" || c === "L");
  return {
    competitionId: leagueId,
    seasonYear: season,
    groupLabel: raw.group ?? null,
    position: raw.rank,
    teamId: raw.team.id,
    played: raw.all.played,
    won: raw.all.win,
    drawn: raw.all.draw,
    lost: raw.all.lose,
    gf: raw.all.goals.for,
    ga: raw.all.goals.against,
    gd: raw.goalsDiff,
    points: raw.points,
    form,
    team: mapTeam(raw.team),
  };
}

interface RawStandingsEnvelope {
  league: { id: number; season: number; standings: RawStandingRow[][] };
}

/** Flatten API-Football's grouped standings (array of arrays) to Standing[]. */
export function mapStandings(env: RawStandingsEnvelope): Standing[] {
  const { id, season, standings } = env.league;
  return standings.flat().map((row) => mapStandingRow(row, id, season));
}

interface RawScorer {
  player: { id: number; name: string; nationality?: string };
  statistics: {
    team: RawTeam;
    goals: { total: number | null; assists: number | null };
  }[];
}

export function mapTopScorers(
  raw: RawScorer[],
  leagueId: number,
  season: number,
): TopScorer[] {
  return raw.map((row, i) => {
    const stat = row.statistics[0];
    return {
      competitionId: leagueId,
      seasonYear: season,
      playerId: row.player.id,
      teamId: stat?.team.id ?? 0,
      goals: stat?.goals.total ?? 0,
      assists: stat?.goals.assists ?? 0,
      rank: i + 1,
      player: {
        id: row.player.id,
        slug: entitySlug(row.player.name, row.player.id),
        name: row.player.name,
        nationality: row.player.nationality,
      },
      team: stat ? mapTeam(stat.team) : undefined,
    };
  });
}

interface RawOdds {
  fixture: { id: number };
  bookmakers: {
    name: string;
    bets: { name: string; values: { value: string; odd: string }[] }[];
  }[];
}

/** The big European online bookmakers, most popular first. Books in the API
 *  response are ranked by this list (unknown names keep response order after
 *  the known ones) and the top five are shown for comparison. */
const BOOKMAKER_PRIORITY = [
  "bet365",
  "winamax",
  "stake",
  "bwin",
  "unibet",
  "william hill",
  "betfair",
  "betway",
  "1xbet",
  "pinnacle",
  "betsson",
  "ladbrokes",
  "888sport",
  "paddy power",
];

const MAX_BOOKS = 5;

function bookRank(name: string): number {
  // Normalize feed variants like "Stake.com" / "888Sport " before matching.
  const key = name.trim().toLowerCase().replace(/\.com$/, "");
  const i = BOOKMAKER_PRIORITY.indexOf(key);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

/** Map every bookmaker's "Match Winner" (1X2) market to neutral decimal odds,
 *  keeping the top five biggest European platforms so visitors can compare who
 *  offers the best price. */
export function mapOdds(raw: RawOdds | undefined, matchId: number): Odds | undefined {
  if (!raw) return undefined;

  const books = (raw.bookmakers ?? [])
    .map((book, i) => {
      const market = book.bets.find((b) => b.name === "Match Winner");
      const pick = (value: string) => {
        const o = market?.values.find((v) => v.value === value)?.odd;
        const n = o != null ? Number(o) : NaN;
        return Number.isFinite(n) ? n : undefined;
      };
      return {
        rank: bookRank(book.name),
        order: i,
        odds: { name: book.name, home: pick("Home"), draw: pick("Draw"), away: pick("Away") },
      };
    })
    // a book with no 1X2 prices at all adds nothing to a comparison
    .filter((b) => b.odds.home != null || b.odds.draw != null || b.odds.away != null)
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .slice(0, MAX_BOOKS)
    .map((b) => b.odds);

  return { matchId, books };
}

interface RawTeamEnvelope {
  team: { id: number; name: string; logo?: string; country?: string; founded?: number | null };
  venue?: { id: number | null; name?: string | null; city?: string | null; capacity?: number | null; surface?: string | null; image?: string | null };
}

export function mapTeamProfile(raw: RawTeamEnvelope): TeamProfile {
  const team = mapTeam({ id: raw.team.id, name: raw.team.name, logo: raw.team.logo });
  return {
    team: { ...team, country: raw.team.country, venueId: raw.venue?.id ?? undefined },
    country: raw.team.country,
    founded: raw.team.founded ?? undefined,
    venue: raw.venue?.id
      ? {
          id: raw.venue.id,
          name: raw.venue.name ?? "",
          city: raw.venue.city ?? undefined,
          capacity: raw.venue.capacity ?? undefined,
          surface: raw.venue.surface ?? undefined,
          image: raw.venue.image ?? undefined,
        }
      : undefined,
  };
}

interface RawSquad {
  players: { id: number; name: string; age?: number; number?: number | null; position?: string | null; photo?: string }[];
}

export function mapSquad(raw: RawSquad | undefined, teamId: number): Player[] {
  if (!raw) return [];
  return raw.players.map((p) => ({
    id: p.id,
    slug: entitySlug(p.name, p.id),
    name: p.name,
    position: p.position ?? undefined,
    number: p.number ?? undefined,
    teamId,
  }));
}

interface RawPlayerEnvelope {
  player: { id: number; name: string; firstname?: string; lastname?: string; age?: number; nationality?: string; height?: string; weight?: string; photo?: string };
  statistics: {
    team?: { id: number; name: string };
    games?: { appearences?: number | null; minutes?: number | null; position?: string | null; rating?: string | null };
    goals?: { total?: number | null; assists?: number | null };
    cards?: { yellow?: number | null; red?: number | null };
  }[];
}

export function mapPlayerProfile(raw: RawPlayerEnvelope): PlayerProfile {
  const stats = raw.statistics ?? [];
  const sum = (sel: (s: RawPlayerEnvelope["statistics"][number]) => number | null | undefined) =>
    stats.reduce((acc, s) => acc + (sel(s) ?? 0), 0);
  const ratings = stats.map((s) => Number(s.games?.rating)).filter((n) => Number.isFinite(n));
  const main = stats[0];
  return {
    player: {
      id: raw.player.id,
      slug: entitySlug(raw.player.name, raw.player.id),
      name: raw.player.name,
      position: main?.games?.position ?? undefined,
      nationality: raw.player.nationality,
      teamId: main?.team?.id,
    },
    photo: raw.player.photo,
    age: raw.player.age,
    height: raw.player.height,
    weight: raw.player.weight,
    teamName: main?.team?.name,
    teamId: main?.team?.id,
    stats: {
      appearances: sum((s) => s.games?.appearences) || undefined,
      minutes: sum((s) => s.games?.minutes) || undefined,
      goals: sum((s) => s.goals?.total),
      assists: sum((s) => s.goals?.assists),
      yellow: sum((s) => s.cards?.yellow),
      red: sum((s) => s.cards?.red),
      rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined,
    },
  };
}

interface RawCoach {
  id: number;
  name: string;
  age?: number | null;
  nationality?: string | null;
  photo?: string;
  team?: { name?: string };
}

export function mapCoach(raw: RawCoach): Coach {
  return {
    id: raw.id,
    name: raw.name,
    age: raw.age ?? undefined,
    nationality: raw.nationality ?? undefined,
    photo: raw.photo,
    teamName: raw.team?.name,
  };
}

interface RawVenue {
  id: number;
  name: string;
  city?: string | null;
  country?: string | null;
  capacity?: number | null;
  surface?: string | null;
  image?: string | null;
}

export function mapVenue(raw: RawVenue): Venue {
  return {
    id: raw.id,
    name: raw.name,
    city: raw.city ?? undefined,
    country: raw.country ?? undefined,
    capacity: raw.capacity ?? undefined,
    surface: raw.surface ?? undefined,
    image: raw.image ?? undefined,
  };
}

/* ------------------------------- the provider ------------------------------- */

interface RawLeague {
  league: { id: number; name: string; type: string; logo?: string };
  country: { name: string };
  seasons: { year: number; current: boolean }[];
}

export const apiFootball: FootballProvider = {
  name: "apiFootball",

  async getLeagues(): Promise<Competition[]> {
    return swr("leagues:all", TTL.competitions, async () => {
      const env = await apiGet<RawLeague>("/leagues", {}, { revalidate: TTL.competitions });
      return env.response
        .filter((l) => getCompetitionByLeagueId(l.league.id))
        .map((l) => {
          const comp = getCompetitionByLeagueId(l.league.id)!;
          const current = l.seasons.find((s) => s.current);
          return {
            id: l.league.id,
            slug: comp.slug,
            name: comp.name,
            country: l.country.name,
            type: comp.type,
            logo: l.league.logo,
            currentSeasonId: current?.year,
          } satisfies Competition;
        });
    });
  },

  async getCurrentSeason(competitionId: number): Promise<Season | undefined> {
    return swr(`season:${competitionId}`, TTL.competitions, async () => {
      const comp = getCompetitionByLeagueId(competitionId);
      const fallbackYear = comp?.defaultSeason ?? new Date().getUTCFullYear();
      try {
        const env = await apiGet<RawLeague>("/leagues", { id: competitionId }, { revalidate: TTL.competitions });
        const league = env.response[0];
        const current = league?.seasons.find((s) => s.current);
        const year = current?.year ?? fallbackYear;
        return {
          id: year,
          competitionId,
          label: `${year}`,
          year,
          isCurrent: true,
        } satisfies Season;
      } catch {
        return {
          id: fallbackYear,
          competitionId,
          label: `${fallbackYear}`,
          year: fallbackYear,
          isCurrent: false,
        } satisfies Season;
      }
    });
  },

  async getFixturesByDate(dateIso: string): Promise<Match[]> {
    return swr(`fixtures:date:${dateIso}`, TTL.fixtures, async () => {
      const env = await apiGet<RawFixture>("/fixtures", { date: dateIso }, { revalidate: TTL.fixtures });
      return env.response.map(mapFixture);
    });
  },

  async getFixturesByLeague(leagueId: number, season: number): Promise<Match[]> {
    return swr(`fixtures:league:${leagueId}:${season}`, TTL.fixtures, async () => {
      const env = await apiGet<RawFixture>("/fixtures", { league: leagueId, season }, { revalidate: TTL.fixtures });
      return env.response.map(mapFixture);
    });
  },

  async getLiveFixtures(): Promise<Match[]> {
    return swr("fixtures:live", TTL.live, async () => {
      const env = await apiGet<RawFixture>("/fixtures", { live: "all" }, { revalidate: TTL.live });
      // Scope to our nine competitions only.
      const live = env.response.map(mapFixture).filter((m) => getCompetitionByLeagueId(m.competitionId));
      // Some fixtures report a live status on their own record but never surface in
      // the global live=all feed (seen with the World Cup data). Back-fill from
      // the in-scope fixtures around now so a live match is never missing from Live
      // Now. We span yesterday→tomorrow so a game that stays live across midnight
      // (or one in a timezone ahead of/behind ours) is still caught.
      try {
        const today = todayKey();
        const days = [shiftDateKey(today, -1), today, shiftDateKey(today, 1)];
        const batches = await Promise.all(days.map((d) => apiFootball.getFixturesByDate(d).catch(() => [] as Match[])));
        const seen = new Set(live.map((m) => m.id));
        for (const m of batches.flat()) {
          if ((m.status === "live" || m.status === "ht") && getCompetitionByLeagueId(m.competitionId) && !seen.has(m.id)) {
            seen.add(m.id);
            live.push(m);
          }
        }
      } catch {
        /* best-effort back-fill; the live=all result is still returned */
      }
      return live;
    });
  },

  async getMatch(fixtureId: number): Promise<Match | undefined> {
    return swr(`fixture:${fixtureId}`, TTL.live, async () => {
      const env = await apiGet<RawFixture>("/fixtures", { id: fixtureId }, { revalidate: TTL.live });
      const raw = env.response[0];
      return raw ? mapFixture(raw) : undefined;
    });
  },

  async getEvents(fixtureId: number): Promise<MatchEvent[]> {
    return swr(`events:${fixtureId}`, TTL.live, async () => {
      const env = await apiGet<RawEvent>("/fixtures/events", { fixture: fixtureId }, { revalidate: TTL.live });
      return env.response.map((e, i) => mapEvent(e, fixtureId, i));
    });
  },

  async getLineups(fixtureId: number): Promise<Lineup[]> {
    return swr(`lineups:${fixtureId}`, TTL.lineups, async () => {
      const env = await apiGet<RawLineup>("/fixtures/lineups", { fixture: fixtureId }, { revalidate: TTL.lineups });
      return env.response.map((l) => mapLineup(l, fixtureId));
    });
  },

  async getStatistics(fixtureId: number): Promise<MatchStats[]> {
    return swr(`stats:${fixtureId}`, TTL.live, async () => {
      const env = await apiGet<RawStatistics>("/fixtures/statistics", { fixture: fixtureId }, { revalidate: TTL.live });
      return env.response.map((s) => mapStatistics(s, fixtureId));
    });
  },

  async getStandings(leagueId: number, season: number): Promise<Standing[]> {
    return swr(`standings:${leagueId}:${season}`, TTL.standings, async () => {
      const env = await apiGet<RawStandingsEnvelope>("/standings", {
        league: leagueId,
        season,
      }, { revalidate: TTL.standings });
      const first = env.response[0];
      return first ? mapStandings(first) : [];
    });
  },

  async getTopScorers(leagueId: number, season: number): Promise<TopScorer[]> {
    return swr(`scorers:${leagueId}:${season}`, TTL.topScorers, async () => {
      // /players/topscorers is NOT paginated — it rejects a `page` param.
      const env = await apiGet<RawScorer>("/players/topscorers", { league: leagueId, season }, { revalidate: TTL.topScorers });
      return mapTopScorers(env.response, leagueId, season);
    });
  },

  async getHeadToHead(team1Id: number, team2Id: number, limit = 5): Promise<Match[]> {
    return swr(`h2h:${team1Id}:${team2Id}:${limit}`, TTL.standings, async () => {
      const env = await apiGet<RawFixture>("/fixtures/headtohead", {
        h2h: `${team1Id}-${team2Id}`,
        last: limit,
      }, { revalidate: TTL.standings });
      return env.response.map(mapFixture);
    });
  },

  async getTeamFixtures(teamId: number, opts: TeamFixturesOptions): Promise<Match[]> {
    const params: Record<string, string | number> = { team: teamId };
    if (opts.last) params.last = opts.last;
    if (opts.next) params.next = opts.next;
    const key = `teamfix:${teamId}:${opts.last ?? 0}:${opts.next ?? 0}`;
    return swr(key, TTL.fixtures, async () => {
      const env = await apiGet<RawFixture>("/fixtures", params, { revalidate: TTL.fixtures });
      return env.response.map(mapFixture);
    });
  },

  async getOdds(fixtureId: number): Promise<Odds | undefined> {
    return swr(`odds:${fixtureId}`, TTL.standings, async () => {
      const env = await apiGet<RawOdds>("/odds", { fixture: fixtureId }, { revalidate: TTL.standings });
      return mapOdds(env.response[0], fixtureId);
    });
  },

  async getTopAssists(leagueId: number, season: number): Promise<TopScorer[]> {
    return swr(`assists:${leagueId}:${season}`, TTL.topScorers, async () => {
      // /players/topassists is NOT paginated either.
      const env = await apiGet<RawScorer>("/players/topassists", { league: leagueId, season }, { revalidate: TTL.topScorers });
      return mapTopScorers(env.response, leagueId, season).map((t, i) => ({ ...t, rank: i + 1 }));
    });
  },

  async getTeam(teamId: number): Promise<TeamProfile | undefined> {
    return swr(`team:${teamId}`, TTL.teams, async () => {
      const env = await apiGet<RawTeamEnvelope>("/teams", { id: teamId }, { revalidate: TTL.teams });
      return env.response[0] ? mapTeamProfile(env.response[0]) : undefined;
    });
  },

  async getSquad(teamId: number): Promise<Player[]> {
    return swr(`squad:${teamId}`, TTL.teams, async () => {
      const env = await apiGet<RawSquad>("/players/squads", { team: teamId }, { revalidate: TTL.teams });
      return mapSquad(env.response[0], teamId);
    });
  },

  async getPlayer(playerId: number, season: number): Promise<PlayerProfile | undefined> {
    return swr(`player:${playerId}:${season}`, TTL.standings, async () => {
      const env = await apiGet<RawPlayerEnvelope>("/players", { id: playerId, season }, { revalidate: TTL.standings });
      return env.response[0] ? mapPlayerProfile(env.response[0]) : undefined;
    });
  },

  async getCoach(coachId: number): Promise<Coach | undefined> {
    return swr(`coach:${coachId}`, TTL.teams, async () => {
      const env = await apiGet<RawCoach>("/coachs", { id: coachId }, { revalidate: TTL.teams });
      return env.response[0] ? mapCoach(env.response[0]) : undefined;
    });
  },

  async getVenue(venueId: number): Promise<Venue | undefined> {
    return swr(`venue:${venueId}`, TTL.teams, async () => {
      const env = await apiGet<RawVenue>("/venues", { id: venueId }, { revalidate: TTL.teams });
      return env.response[0] ? mapVenue(env.response[0]) : undefined;
    });
  },

  async searchTeams(query: string): Promise<Team[]> {
    const q = query.trim();
    if (q.length < 3) return []; // API-Football requires >= 3 chars for search
    return swr(`searchteams:${q.toLowerCase()}`, TTL.teams, async () => {
      const env = await apiGet<RawTeamEnvelope>("/teams", { search: q }, { revalidate: TTL.teams });
      return env.response.map((r) => ({
        ...mapTeam({ id: r.team.id, name: r.team.name, logo: r.team.logo }),
        country: r.team.country,
      }));
    });
  },

  async getTeamsByLeague(leagueId: number, season: number): Promise<Team[]> {
    return swr(`teams:league:${leagueId}:${season}`, TTL.teams, async () => {
      const env = await apiGet<RawTeamEnvelope>("/teams", { league: leagueId, season }, { revalidate: TTL.teams });
      return env.response.map((r) => ({
        ...mapTeam({ id: r.team.id, name: r.team.name, logo: r.team.logo }),
        country: r.team.country,
      }));
    });
  },
};

/**
 * BUILD STEP ZERO helper (CLAUDE.md section 2). Confirms the MLS and World Cup
 * ids by name search and reports any mismatch with the constants. Intended to be
 * run once via a script/route after the key is present; it does not mutate the
 * constants file (do that by hand once confirmed).
 */
export async function verifyLeagueIds(): Promise<
  { name: string; searchedId: number; matchedId: number | null; ok: boolean }[]
> {
  const toCheck = COMPETITIONS.filter((c) => !c.verified);
  const results: { name: string; searchedId: number; matchedId: number | null; ok: boolean }[] = [];
  for (const comp of toCheck) {
    const query = comp.slug === "world-cup" ? "World Cup" : comp.name;
    const env = await apiGet<RawLeague>("/leagues", { search: query });
    const match = env.response.find(
      (l) => l.league.name.toLowerCase() === comp.name.toLowerCase(),
    );
    results.push({
      name: comp.name,
      searchedId: comp.leagueId,
      matchedId: match?.league.id ?? null,
      ok: match?.league.id === comp.leagueId,
    });
  }
  return results;
}
