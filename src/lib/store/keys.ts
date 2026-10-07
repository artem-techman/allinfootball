/**
 * Key layout of the football data store (Upstash Redis). The ingest worker is
 * the only writer; the site only reads. One record per fixture is the single
 * source of truth — every list (a day, a team, a league season) holds fixture
 * IDS, so a status change is written once and every page agrees.
 *
 *   fx:{id}                         Match — the fixture record
 *   day:{YYYY-MM-DD}:{league}       number[] — a UK day's fixture ids for one competition
 *   league:{league}:{season}        number[] — a season's fixture ids, kickoff order
 *   team:{team}:{league}:{season}   number[] — a team's fixture ids in one competition
 *   leaguedays:{league}:{season}    string[] — the day keys that league season wrote
 *   detail:{id}                     FixtureDetail — final events/lineups/stats (immutable)
 *   live                            LiveSnapshot — in-play matches, refreshed every 30s
 *   livedetail (hash)               id → FixtureDetail for in-window fixtures
 *   standings:{league}:{season}     Stamped<Standing[]>
 *   scorers:{league}:{season}       Stamped<TopScorer[]>
 *   assists:{league}:{season}       Stamped<TopScorer[]>
 *   teams (hash)                    "{team}:{league}" → TeamEntry (search, team lists)
 *   meta (hash)                     worker schedule state (ms timestamps)
 *   lock                            single-flight worker lock
 */
import type { Lineup, Match, MatchEvent, MatchStats, Team } from "@/lib/providers/types";

export const K = {
  fx: (id: number) => `fx:${id}`,
  day: (date: string, league: number) => `day:${date}:${league}`,
  league: (league: number, season: number) => `league:${league}:${season}`,
  team: (team: number, league: number, season: number) => `team:${team}:${league}:${season}`,
  leagueDays: (league: number, season: number) => `leaguedays:${league}:${season}`,
  detail: (id: number) => `detail:${id}`,
  live: "live",
  liveDetail: "livedetail",
  standings: (league: number, season: number) => `standings:${league}:${season}`,
  scorers: (league: number, season: number) => `scorers:${league}:${season}`,
  assists: (league: number, season: number) => `assists:${league}:${season}`,
  teams: "teams",
  meta: "meta",
  lock: "lock",
} as const;

export interface Stamped<T> {
  data: T;
  /** ms epoch when the worker wrote it. */
  updatedAt: number;
}

export interface LiveSnapshot {
  matches: Match[];
  updatedAt: number;
}

export interface FixtureDetail {
  match: Match;
  events?: MatchEvent[];
  lineups?: Lineup[];
  stats?: MatchStats[];
  updatedAt: number;
}

export interface TeamEntry {
  team: Team;
  league: number;
}

/** A fixture whose record can no longer change. */
export const FINAL_STATUSES = new Set<Match["status"]>(["finished", "postponed", "cancelled", "abandoned"]);
