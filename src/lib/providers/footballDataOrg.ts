import type { FootballProvider } from "./types";

/**
 * football-data.org adapter — STUB (interface only) for v1. Selected when
 * PROVIDER=footballDataOrg. Intended as a Premier-League-only free fallback
 * (CLAUDE.md section 5). Each method throws until implemented so a misconfigured
 * PROVIDER fails loudly rather than returning empty data silently.
 */
const notImplemented = (method: string) => (): never => {
  throw new Error(
    `footballDataOrg.${method}() is not implemented in v1. Set PROVIDER=apiFootball.`,
  );
};

export const footballDataOrg: FootballProvider = {
  name: "footballDataOrg",
  getLeagues: notImplemented("getLeagues"),
  getCurrentSeason: notImplemented("getCurrentSeason"),
  getFixturesByDate: notImplemented("getFixturesByDate"),
  getFixturesByLeague: notImplemented("getFixturesByLeague"),
  getLiveFixtures: notImplemented("getLiveFixtures"),
  getMatch: notImplemented("getMatch"),
  getEvents: notImplemented("getEvents"),
  getLineups: notImplemented("getLineups"),
  getStatistics: notImplemented("getStatistics"),
  getStandings: notImplemented("getStandings"),
  getTopScorers: notImplemented("getTopScorers"),
  getHeadToHead: notImplemented("getHeadToHead"),
  getTeamFixtures: notImplemented("getTeamFixtures"),
  getOdds: notImplemented("getOdds"),
  getTopAssists: notImplemented("getTopAssists"),
  getTeam: notImplemented("getTeam"),
  getSquad: notImplemented("getSquad"),
  getPlayer: notImplemented("getPlayer"),
  getCoach: notImplemented("getCoach"),
  getVenue: notImplemented("getVenue"),
  searchTeams: notImplemented("searchTeams"),
  getTeamsByLeague: notImplemented("getTeamsByLeague"),
  getTeamTransfers: notImplemented("getTeamTransfers"),
};
