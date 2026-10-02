import "server-only";

import { swr, TTL } from "@/lib/cache";
import {
  COMPETITIONS,
  getCompetitionByLeagueId,
  isInScope,
} from "@/lib/constants/competitions";
import { entitySlug } from "@/lib/utils/slug";
import { mapStatus } from "./statusMap";
import { seasonYearFor } from "@/lib/season";
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
  Transfer,
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
    status: { short: string; elapsed: number | null; extra?: number | null };
    venue?: { id: number | null; name?: string | null; city?: string | null };
    referee?: string | null;
  };
  league: { id: number; season: number; round?: string };
  teams: { home: RawTeam; away: RawTeam };
  goals: { home: number | null; away: number | null };
  score?: { penalty?: { home: number | null; away: number | null } };
  // Present only on `/fixtures?ids=` responses: the full match bundle in one call.
  events?: RawEvent[];
  lineups?: RawLineup[];
  statistics?: RawStatistics[];
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
let budgetWarned80 = false;

/**
 * Retries for the PER-MINUTE rate limit (HTTP 200 + errors.rateLimit), separate
 * from the HTTP 429/5xx retry budget. Kept small so a genuinely saturated minute
 * degrades to last-good cache quickly rather than hanging a page.
 */
const RATE_LIMIT_RETRIES = 3;

/**
 * Today's usage from API-Football's own `/status` — which is FREE (it does not
 * count against the quota). Cached 60s in the shared data cache, so it costs ~1
 * free call/min across the fleet. Also reads the plan's real daily limit: if the
 * subscription ever drops (it fell to the 100/day Free plan on 2026-10-01), the
 * budget shrinks with it automatically instead of assuming 7,500.
 * Returns null if it can't be read.
 */
export async function dailyUsage(): Promise<{ used: number; limit: number | null } | null> {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${BASE_URL}/status`, {
      headers: { "x-apisports-key": key },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { response?: { requests?: { current?: number; limit_day?: number } } };
    const current = data.response?.requests?.current;
    const limit = data.response?.requests?.limit_day;
    if (typeof current !== "number") return null;
    return { used: current, limit: typeof limit === "number" && limit > 0 ? limit : null };
  } catch {
    return null;
  }
}

/**
 * How important a call is. Under quota pressure we shed the least important
 * first, so the last thing standing is live scores:
 *  - live:   live=all, the live-detail batch, live-dispute checks
 *  - core:   fixtures, standings, single match + its events/lineups/stats
 *  - detail: team, squad, player, scorers, assists
 *  - extra:  odds, head-to-head, transfers, team search
 */
export type CallPriority = "live" | "core" | "detail" | "extra";

/** Share of the daily budget at which each priority stops calling the provider. */
const SHED_AT: Record<CallPriority, number> = { extra: 0.7, detail: 0.85, core: 0.95, live: 1 };

/** The budget actually in force: our soft ceiling, or 93% of the plan's limit if lower. */
export function effectiveBudget(limitDay: number | null): number {
  return limitDay ? Math.min(DAILY_BUDGET, Math.floor(limitDay * 0.93)) : DAILY_BUDGET;
}

/**
 * Whether a call of this priority may go upstream at this usage. Pure, exported
 * for testing. Unknown usage (the /status read failed) FAILS CLOSED for the
 * low-priority tiers — we can't prove there's headroom, so odds/H2H/team detail
 * wait — while live and core data still flow. FOOTBALL_BROWNOUT_FORCE (0..1)
 * simulates a usage share for drills.
 */
export function allowCall(
  priority: CallPriority,
  usage: { used: number; limit: number | null } | null,
  force = Number(process.env.FOOTBALL_BROWNOUT_FORCE),
): boolean {
  if (Number.isFinite(force) && force > 0) return force < SHED_AT[priority];
  if (!usage) return priority === "live" || priority === "core";
  return usage.used / effectiveBudget(usage.limit) < SHED_AT[priority];
}

/** Current shedding tier for status reporting: 0 = normal … 4 = provider closed. */
export async function brownoutLevel(): Promise<{ level: number; used: number | null; budget: number }> {
  const usage = await dailyUsage();
  const budget = effectiveBudget(usage?.limit ?? null);
  const order: CallPriority[] = ["extra", "detail", "core", "live"];
  const level = order.filter((p) => !allowCall(p, usage)).length;
  return { level, used: usage?.used ?? null, budget };
}

let lastLimitDay: number | null = null;

/**
 * GET an endpoint with exponential backoff + jitter on 429/5xx (section 10).
 * Throws on exhausted retries; the swr() layer serves last-good cache on throw.
 * Refuses to call the provider once the daily budget is reached (circuit breaker).
 */
async function apiGet<T>(
  path: string,
  params: Record<string, string | number> = {},
  opts: { revalidate?: number; maxRetries?: number; priority?: CallPriority } = {},
): Promise<RawEnvelope<T>> {
  // maxRetries defaults to 1 (was 3): a 429 means we're at the per-minute rate
  // limit, and retrying multiplies requests against the daily quota. One short
  // retry is enough; the swr() layer serves last-good cache on a hard failure.
  const { revalidate, maxRetries = 1, priority = "core" } = opts;
  const key = requireKey();

  // Circuit breaker + brownout: shed low-priority calls first as usage climbs,
  // and stop entirely at the budget. Before 2026-10-02 this failed OPEN when
  // /status couldn't be read; now unknown usage only lets live/core through.
  const usage = await dailyUsage();
  if (usage?.limit != null && lastLimitDay != null && usage.limit !== lastLimitDay) {
    console.warn(`[apiFootball] plan daily limit changed ${lastLimitDay} -> ${usage.limit}`);
  }
  if (usage?.limit != null) lastLimitDay = usage.limit;
  const budget = effectiveBudget(usage?.limit ?? null);
  // Early warning at 80% so exhaustion is visible in the logs BEFORE it happens
  // (the 2026-07-10 outage was only discovered at 103%).
  if (usage && !budgetWarned80 && usage.used >= budget * 0.8) {
    console.warn(`[apiFootball] daily usage at ${usage.used}/${budget} (>=80%) — shedding low-priority calls`);
    budgetWarned80 = true;
  }
  if (!allowCall(priority, usage)) {
    if (usage && usage.used >= budget && !budgetWarned) {
      console.warn(`[apiFootball] daily budget reached (${usage.used}/${budget}) — serving cached/empty until reset`);
      budgetWarned = true;
    }
    throw new Error(`API-Football ${priority} call shed (usage ${usage?.used ?? "unknown"}/${budget})`);
  }

  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  let attempt = 0;
  // Once we've seen a cached rate-limit error we must BYPASS Next's data cache on
  // retry — see the rate-limit branch below for why.
  let bypassCache = false;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetch(url, {
      headers: { "x-apisports-key": key },
      // Durable, cross-instance caching via Next's data cache. Unlike the
      // in-memory swr() map (which is per-lambda and lost on cold start), this
      // is shared across all serverless invocations, so concurrent requests and
      // cold starts reuse one provider response per `revalidate` window instead
      // of each re-hitting the API. Falls back to no-store when no TTL is given.
      ...(bypassCache || revalidate == null
        ? { cache: "no-store" as const }
        : { next: { revalidate } }),
    });

    if (res.ok) {
      // Next's data cache is STALE-WHILE-REVALIDATE: once an entry expires, the
      // next request is still handed the old body (however old) while a refresh
      // runs in the background. For live data that was the "match page is empty
      // until I reload" bug: the first visit got the pre-kickoff record (no
      // score, no lineups, status NS) and only the reload saw the refreshed one.
      // The provider's own Date header survives the cache, so it tells us the
      // body's true age; anything older than its TTL plus a small grace is
      // refetched straight from the API instead of being served.
      if (!bypassCache && revalidate != null && isTooStale(res.headers.get("date"), revalidate)) {
        bypassCache = true;
        continue;
      }
      const env = (await res.json()) as RawEnvelope<T>;
      // API-Football returns HTTP 200 with a populated `errors` object on
      // application-level failures (bad params, rate limit, etc.). Treat those
      // as errors instead of silently yielding an empty response.
      const errs = env.errors;
      const hasErrors = Array.isArray(errs)
        ? errs.length > 0
        : errs != null && typeof errs === "object" && Object.keys(errs).length > 0;
      if (hasErrors) {
        // The PER-MINUTE rate limit is delivered as HTTP 200 + errors.rateLimit
        // ("Too many requests…"), NOT as a 429. Two problems compound: (1) it's a
        // 429-equivalent so it should back off + retry, not throw; and (2) because
        // it's an HTTP 200, Next's data cache CACHES the error body for the whole
        // revalidate window — so a single transient rate-limit blip pins a date/
        // page to empty and every later request re-reads the cached error. That's
        // exactly what hid 2026-09-12. So on rate-limit we retry with the cache
        // BYPASSED (cache:"no-store"), which both ignores the poisoned entry and
        // hits the API fresh. Real errors (bad params, etc.) still throw at once.
        const isRateLimit = /rate.?limit|too many requests/i.test(JSON.stringify(errs));
        if (isRateLimit && attempt < RATE_LIMIT_RETRIES) {
          bypassCache = true;
          await sleep(Math.min(1500 * 2 ** attempt, 8000) + Math.random() * 250);
          attempt += 1;
          continue;
        }
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

/** Seconds past its TTL a cached provider body may be before we refetch it:
 *  half the TTL, at least 10s — so a 30s live key is never served beyond 45s,
 *  while rarely-read long-TTL keys don't pay a refetch on every stale hit. */
const staleGraceS = (revalidateS: number) => Math.max(10, revalidateS / 2);

/**
 * True when a cached response (by its provider `Date` header) is older than its
 * TTL plus grace. A missing or unparseable header counts as fresh, so an
 * upstream header change can never turn every cache hit into a paid refetch.
 * Exported for testing.
 */
export function isTooStale(dateHeader: string | null, revalidateS: number, now = Date.now()): boolean {
  if (!dateHeader) return false;
  const fetchedAt = Date.parse(dateHeader);
  if (!Number.isFinite(fetchedAt)) return false;
  return now - fetchedAt > (revalidateS + staleGraceS(revalidateS)) * 1000;
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

/**
 * Combine the two live sources into the Live Now list. Pure, exported for tests.
 *
 *  - `bundles`: fresh by-id records for every in-scope fixture in its live window
 *    (`/fixtures?ids=`, the same call that feeds match pages). Authoritative: if a
 *    fixture is in here, its status here decides — this is what ends a match on
 *    time, and what stops a stale copy bringing an ended match back to life
 *    (Kazakhstan v Moldova flipping between "Live" and "Up next").
 *  - `liveAll`: the provider's global live feed. It can lag the final whistle
 *    (the 2026 World Cup final froze at 104'), so it only adds matches the
 *    bundles don't cover, and never one our fixture list already shows as over.
 */
export function mergeLiveSources(
  liveAll: Match[],
  listed: Map<number, Match>,
  bundles: Map<number, { match: Match }>,
): Match[] {
  const isLive = (m: Match) => m.status === "live" || m.status === "ht";
  const over = (m: Match) => m.status !== "scheduled" && !isLive(m);
  const out: Match[] = [];
  for (const b of bundles.values()) if (isLive(b.match)) out.push(b.match);
  for (const m of liveAll) {
    if (bundles.has(m.id)) continue;
    const l = listed.get(m.id);
    if (l && over(l)) continue;
    out.push(m);
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
    // Stoppage time arrives separately: elapsed stays at 45/90/105/120 and
    // `extra` counts the added minutes (90 + 3 → "90+3'").
    extraMinute: inPlay && raw.fixture.status.extra ? raw.fixture.status.extra : undefined,
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
    resultType: status === "finished" ? RESULT_TYPE[raw.fixture.status.short] ?? "ft" : undefined,
    competition: {
      ...(comp
        ? { id: comp.leagueId, slug: comp.slug, name: comp.name }
        : { id: raw.league.id, slug: String(raw.league.id), name: String(raw.league.id) }),
      // Cards fell back to initials ("UE", "ML") because no logo was ever set.
      logo: `https://media.api-sports.io/football/leagues/${raw.league.id}.png`,
    },
  };
}

/** How a finished match was decided — "FULL TIME" was shown for extra-time wins. */
const RESULT_TYPE: Record<string, "ft" | "aet" | "pen"> = { FT: "ft", AET: "aet", PEN: "pen" };

/**
 * Map a list of raw fixtures, skipping any single record that fails to map.
 *
 * `/fixtures?date=` returns EVERY fixture worldwide for that day (thousands), and
 * a single malformed record — a null `league`, missing `teams`, etc. — used to
 * throw inside `.map(mapFixture)` and take the ENTIRE day down with it: on
 * 2026-09-12 that hid a full Saturday of Premier League / La Liga / Serie A /
 * Bundesliga / Ligue 1 matches (25 fixtures) even though the data was there.
 * One bad upstream row must never hide a whole slate — skip it and keep the rest.
 */
export function mapFixtures(raw: RawFixture[]): Match[] {
  const out: Match[] = [];
  let skipped = 0;
  for (const r of raw) {
    try {
      out.push(mapFixture(r));
    } catch {
      skipped += 1;
    }
  }
  if (skipped > 0) {
    console.warn(`[apiFootball] skipped ${skipped}/${raw.length} unmappable fixture record(s)`);
  }
  return out;
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

/**
 * Version of mapEvent's output, stored with archived matches. v1 (before
 * 2026-10-02) put the player going OFF in `playerName` for substitutions, so
 * every sub read backwards ("Torres off 58'" then "Torres scores 106'").
 * Archived v1 rows are corrected on read — see fixLegacyEvents.
 */
export const EVENT_MAPPER_VERSION = 2;

export function mapEvent(raw: RawEvent, matchId: number, index: number): MatchEvent {
  let type: MatchEventType;
  if (raw.type === "subst") type = "sub";
  else if (raw.type === "Var") type = "var";
  else type = EVENT_DETAIL_MAP[raw.detail] ?? (raw.type === "Goal" ? "goal" : "var");

  // For a substitution the provider's `player` is the one going OFF and `assist`
  // the one coming ON (verified against live data: a starter who'd scored at 31'
  // appears as `player` on a 54' sub). Our domain model is the other way round —
  // playerName = the subject (player on), relatedPlayerName = the player off.
  const subject = type === "sub" ? raw.assist : raw.player;
  const related = type === "sub" ? raw.player : raw.assist;
  return {
    id: `${matchId}-${index}`,
    matchId,
    minute: raw.time.elapsed ?? 0,
    extraMinute: raw.time.extra ?? undefined,
    type,
    teamId: raw.team.id,
    playerId: subject?.id ?? undefined,
    playerName: decodeName(subject?.name),
    relatedPlayerId: related?.id ?? undefined,
    relatedPlayerName: decodeName(related?.name),
    detail: raw.detail,
  };
}

/** Swap on/off on substitutions mapped by the v1 mapper (archived rows). */
export function fixLegacyEvents(events: MatchEvent[], version: number | null | undefined): MatchEvent[] {
  if ((version ?? 1) >= 2) return events;
  return events.map((e) =>
    e.type === "sub"
      ? {
          ...e,
          playerId: e.relatedPlayerId,
          playerName: e.relatedPlayerName,
          relatedPlayerId: e.playerId,
          relatedPlayerName: e.playerName,
        }
      : e,
  );
}

/** Decode HTML entities the provider sometimes leaves in names ("O&apos;runov"). */
export function decodeName(name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  return name
    .replace(/&apos;|&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));
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

interface RawTransfers {
  player: { id: number; name: string };
  transfers: {
    date: string;
    type: string | null;
    teams: {
      in?: { id: number | null; name: string | null; logo?: string | null };
      out?: { id: number | null; name: string | null; logo?: string | null };
    };
  }[];
}

/** Map API-Football's per-player transfer history (from a team query) into flat
 *  Transfer records. `teams.in` is the club joined, `teams.out` the club left. */
export function mapTransfers(raw: RawTransfers[]): Transfer[] {
  const out: Transfer[] = [];
  for (const row of raw) {
    for (const t of row.transfers ?? []) {
      const to = t.teams.in;
      const from = t.teams.out;
      out.push({
        playerId: row.player.id,
        playerName: row.player.name,
        date: t.date,
        type: t.type ?? undefined,
        from: from?.id ? { id: from.id, name: from.name ?? undefined, crest: from.logo ?? undefined } : undefined,
        to: to?.id ? { id: to.id, name: to.name ?? undefined, crest: to.logo ?? undefined } : undefined,
      });
    }
  }
  return out;
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

/** Club competitions in scope — used to find a player's club among their stat lines. */
const CLUB_LEAGUE_IDS = new Set(COMPETITIONS.filter((c) => c.type !== "international").map((c) => c.leagueId));
/** National-team competitions (World Cup, Nations League, friendlies …). */
const NATIONAL_LEAGUE_IDS = new Set([
  ...COMPETITIONS.filter((c) => c.type === "international").map((c) => c.leagueId),
  10, // international friendlies
]);

interface RawPlayerEnvelope {
  player: { id: number; name: string; firstname?: string; lastname?: string; age?: number; nationality?: string; height?: string; weight?: string; photo?: string };
  statistics: {
    team?: { id: number; name: string };
    league?: { id?: number | null; name?: string | null; season?: number | null };
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
  // The provider's first entry is often the national team (Isak showed as
  // "Sweden"). The club is the entry in a club competition with the most
  // appearances; fall back to the busiest entry of any kind.
  const apps = (s: RawPlayerEnvelope["statistics"][number]) => s.games?.appearences ?? 0;
  const byApps = [...stats].sort((a, b) => apps(b) - apps(a));
  const main =
    byApps.find((s) => s.league?.id != null && CLUB_LEAGUE_IDS.has(s.league.id)) ??
    byApps.find((s) => !NATIONAL_LEAGUE_IDS.has(s.league?.id ?? -1)) ??
    byApps[0];
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
    season: main?.league?.season ?? undefined,
    // MLS runs on the calendar year ("2026"); the European game spans two ("2026/27").
    seasonLabel:
      main?.league?.season == null
        ? undefined
        : main.league.id === 253
          ? String(main.league.season)
          : `${main.league.season}/${String((main.league.season + 1) % 100).padStart(2, "0")}`,
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
  seasons: { year: number; current: boolean; start?: string; end?: string }[];
}

/**
 * Pick the CURRENT season year from a league's seasons list. Robust against a
 * stale `current` flag (API-Football sometimes leaves it on the just-finished
 * season): prefer the season whose [start,end] date range contains today, then
 * the `current`-flagged one, then the most recent year. This is why the Premier
 * League table must never show last season — today's date lands inside the live
 * campaign's range.
 */
export function pickSeasonYear(
  seasons: { year: number; current: boolean; start?: string; end?: string }[],
  fallbackYear: number,
  todayIso: string = new Date().toISOString().slice(0, 10),
): number {
  if (!seasons.length) return fallbackYear;
  const byDate = seasons.find((s) => s.start && s.end && s.start <= todayIso && todayIso <= s.end);
  if (byDate) return byDate.year;
  const flagged = seasons.find((s) => s.current);
  if (flagged) return flagged.year;
  return seasons.reduce((a, b) => (b.year > a.year ? b : a)).year;
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
        const year = pickSeasonYear(league?.seasons ?? [], fallbackYear);
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
      return mapFixtures(env.response);
    });
  },

  async getFixturesByLeague(leagueId: number, season: number): Promise<Match[]> {
    // A whole season's fixtures: the backbone of the scope allow-list, the
    // calendar and team fixtures. Live freshness comes from the live feed and the
    // live-detail batch layered on top (see scoped.ts), so the list itself can
    // refresh slowly — past seasons are immutable.
    const comp = getCompetitionByLeagueId(leagueId);
    const past = comp != null && season < seasonYearFor(comp);
    const ttl = past ? 24 * 60 * 60 : TTL.seasonFixtures;
    return swr(`fixtures:league:${leagueId}:${season}`, ttl, async () => {
      const env = await apiGet<RawFixture>("/fixtures", { league: leagueId, season }, { revalidate: ttl });
      return mapFixtures(env.response);
    });
  },

  async getLiveFixtures(): Promise<Match[]> {
    // live=all, scoped to our competitions (not their qualifying rounds — UCL/UEL
    // qualifiers share the competition's league id). Reconciliation against the
    // fixture lists + the live-detail batch happens in scoped.ts.
    return swr("fixtures:live", TTL.live, async () => {
      const env = await apiGet<RawFixture>("/fixtures", { live: "all" }, { revalidate: TTL.live, priority: "live" });
      return mapFixtures(env.response).filter((m) => isInScope(m.competitionId, m.round));
    });
  },

  async getMatch(fixtureId: number): Promise<Match | undefined> {
    return swr(
      `fixture:${fixtureId}`,
      (m) => (!m ? 300 : m.status === "live" || m.status === "ht" ? TTL.live : m.status === "scheduled" ? 30 * 60 : 6 * 60 * 60),
      async () => {
        const env = await apiGet<RawFixture>("/fixtures", { id: fixtureId }, { revalidate: TTL.live });
        const raw = env.response[0];
        return raw ? mapFixture(raw) : undefined;
      },
    );
  },

  // Events/lineups/stats here serve matches OUTSIDE the live window (finished or
  // far off) — in-window matches come from the batched bundle — so they keep
  // for an hour.
  async getEvents(fixtureId: number, ttl: number = TTL.matchDetail): Promise<MatchEvent[]> {
    return swr(`events:${fixtureId}:${ttl}`, ttl, async () => {
      const env = await apiGet<RawEvent>("/fixtures/events", { fixture: fixtureId }, { revalidate: ttl });
      return env.response.map((e, i) => mapEvent(e, fixtureId, i));
    });
  },


  async getLineups(fixtureId: number, ttl: number = TTL.matchDetail): Promise<Lineup[]> {
    return swr(`lineups:${fixtureId}:${ttl}`, ttl, async () => {
      const env = await apiGet<RawLineup>("/fixtures/lineups", { fixture: fixtureId }, { revalidate: ttl });
      return env.response.map((l) => mapLineup(l, fixtureId));
    });
  },


  async getStatistics(fixtureId: number, ttl: number = TTL.matchDetail): Promise<MatchStats[]> {
    return swr(`stats:${fixtureId}:${ttl}`, ttl, async () => {
      const env = await apiGet<RawStatistics>("/fixtures/statistics", { fixture: fixtureId }, { revalidate: ttl });
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
      const env = await apiGet<RawScorer>("/players/topscorers", { league: leagueId, season }, { revalidate: TTL.topScorers, priority: "detail" });
      return mapTopScorers(env.response, leagueId, season);
    });
  },

  async getHeadToHead(team1Id: number, team2Id: number, limit = 5): Promise<Match[]> {
    return swr(`h2h:${team1Id}:${team2Id}:${limit}`, TTL.h2h, async () => {
      const env = await apiGet<RawFixture>("/fixtures/headtohead", {
        h2h: `${team1Id}-${team2Id}`,
        last: limit,
      }, { revalidate: TTL.h2h, priority: "extra" });
      return mapFixtures(env.response);
    });
  },

  async getTeamFixtures(teamId: number, opts: TeamFixturesOptions): Promise<Match[]> {
    const params: Record<string, string | number> = { team: teamId };
    if (opts.last) params.last = opts.last;
    if (opts.next) params.next = opts.next;
    const key = `teamfix:${teamId}:${opts.last ?? 0}:${opts.next ?? 0}`;
    return swr(key, TTL.fixtures, async () => {
      const env = await apiGet<RawFixture>("/fixtures", params, { revalidate: TTL.fixtures, priority: "detail" });
      return mapFixtures(env.response);
    });
  },

  async getOdds(fixtureId: number): Promise<Odds | undefined> {
    return swr(`odds:${fixtureId}`, TTL.odds, async () => {
      const env = await apiGet<RawOdds>("/odds", { fixture: fixtureId }, { revalidate: TTL.odds, priority: "extra" });
      return mapOdds(env.response[0], fixtureId);
    });
  },

  async getTeamTransfers(teamId: number): Promise<Transfer[]> {
    return swr(`transfers:team:${teamId}`, TTL.transfers, async () => {
      const env = await apiGet<RawTransfers>("/transfers", { team: teamId }, { revalidate: TTL.transfers, priority: "extra" });
      return mapTransfers(env.response);
    });
  },

  async getTopAssists(leagueId: number, season: number): Promise<TopScorer[]> {
    return swr(`assists:${leagueId}:${season}`, TTL.topScorers, async () => {
      // /players/topassists is NOT paginated either.
      const env = await apiGet<RawScorer>("/players/topassists", { league: leagueId, season }, { revalidate: TTL.topScorers, priority: "detail" });
      return mapTopScorers(env.response, leagueId, season).map((t, i) => ({ ...t, rank: i + 1 }));
    });
  },

  async getTeam(teamId: number): Promise<TeamProfile | undefined> {
    return swr(`team:${teamId}`, TTL.teams, async () => {
      const env = await apiGet<RawTeamEnvelope>("/teams", { id: teamId }, { revalidate: TTL.teams, priority: "detail" });
      return env.response[0] ? mapTeamProfile(env.response[0]) : undefined;
    });
  },

  async getSquad(teamId: number): Promise<Player[]> {
    return swr(`squad:${teamId}`, TTL.teams, async () => {
      const env = await apiGet<RawSquad>("/players/squads", { team: teamId }, { revalidate: TTL.teams, priority: "detail" });
      return mapSquad(env.response[0], teamId);
    });
  },

  async getPlayer(playerId: number, season: number): Promise<PlayerProfile | undefined> {
    return swr(`player:${playerId}:${season}`, TTL.player, async () => {
      const env = await apiGet<RawPlayerEnvelope>("/players", { id: playerId, season }, { revalidate: TTL.player, priority: "detail" });
      return env.response[0] ? mapPlayerProfile(env.response[0]) : undefined;
    });
  },

  async getCoach(coachId: number): Promise<Coach | undefined> {
    return swr(`coach:${coachId}`, TTL.teams, async () => {
      const env = await apiGet<RawCoach>("/coachs", { id: coachId }, { revalidate: TTL.teams, priority: "extra" });
      return env.response[0] ? mapCoach(env.response[0]) : undefined;
    });
  },

  async getVenue(venueId: number): Promise<Venue | undefined> {
    return swr(`venue:${venueId}`, TTL.teams, async () => {
      const env = await apiGet<RawVenue>("/venues", { id: venueId }, { revalidate: TTL.teams, priority: "extra" });
      return env.response[0] ? mapVenue(env.response[0]) : undefined;
    });
  },

  async searchTeams(query: string): Promise<Team[]> {
    const q = query.trim();
    if (q.length < 3) return []; // API-Football requires >= 3 chars for search
    return swr(`searchteams:${q.toLowerCase()}`, TTL.teams, async () => {
      const env = await apiGet<RawTeamEnvelope>("/teams", { search: q }, { revalidate: TTL.teams, priority: "extra" });
      return env.response.map((r) => ({
        ...mapTeam({ id: r.team.id, name: r.team.name, logo: r.team.logo }),
        country: r.team.country,
      }));
    });
  },

  async getTeamsByLeague(leagueId: number, season: number): Promise<Team[]> {
    return swr(`teams:league:${leagueId}:${season}`, TTL.teams, async () => {
      const env = await apiGet<RawTeamEnvelope>("/teams", { league: leagueId, season }, { revalidate: TTL.teams, priority: "detail" });
      return env.response.map((r) => ({
        ...mapTeam({ id: r.team.id, name: r.team.name, logo: r.team.logo }),
        country: r.team.country,
      }));
    });
  },
};

/** Everything a match page needs, from one `/fixtures?ids=` record. */
export interface FixtureBundle {
  match: Match;
  /** Undefined when the provider didn't embed that section (fall back per-fixture). */
  events?: MatchEvent[];
  lineups?: Lineup[];
  stats?: MatchStats[];
}

/**
 * Full bundles for up to N fixtures in ONE request per 20 ids — the provider
 * embeds events, lineups and statistics in `/fixtures?ids=` records. This is
 * what keeps live-match cost flat: every live or about-to-start match is
 * refreshed together, however many of them fans have open, instead of
 * 3–4 calls per match per refresh. Keyed by the sorted id set so every server
 * instance asking for the same window shares one cached response.
 */
export async function getFixtureBundles(ids: number[]): Promise<Map<number, FixtureBundle>> {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  const out = new Map<number, FixtureBundle>();
  for (let i = 0; i < sorted.length; i += 20) {
    const chunk = sorted.slice(i, i + 20);
    const bundles = await swr(`bundles:${chunk.join("-")}`, TTL.liveDetail, async () => {
      const env = await apiGet<RawFixture>(
        "/fixtures",
        { ids: chunk.join("-") },
        { revalidate: TTL.liveDetail, priority: "live" },
      );
      const list: FixtureBundle[] = [];
      for (const raw of env.response) {
        try {
          const id = raw.fixture.id;
          list.push({
            match: mapFixture(raw),
            events: Array.isArray(raw.events) ? raw.events.map((e, n) => mapEvent(e, id, n)) : undefined,
            lineups: Array.isArray(raw.lineups) ? raw.lineups.map((l) => mapLineup(l, id)) : undefined,
            stats: Array.isArray(raw.statistics) ? raw.statistics.map((st) => mapStatistics(st, id)) : undefined,
          });
        } catch {
          /* skip one malformed record, keep the rest */
        }
      }
      return list;
    });
    for (const b of bundles) out.set(b.match.id, b);
  }
  return out;
}

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
