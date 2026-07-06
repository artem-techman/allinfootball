/**
 * OUR domain types (CLAUDE.md section 6). Pages and components consume ONLY
 * these — never raw API-Football JSON. The adapter (apiFootball.ts) is the only
 * place that knows the provider's shape. Every numeric stat is optional because
 * providers omit fields for some competitions (xG is frequently absent);
 * components must render "-" / hide blocks when a value is null/undefined.
 */

export type MatchStatus =
  | "scheduled"
  | "live"
  | "ht"
  | "finished"
  | "postponed"
  | "cancelled"
  | "abandoned"
  | "suspended";

export type CompetitionType = "league" | "cup" | "international";

export interface Competition {
  id: number;
  slug: string;
  name: string;
  country: string;
  type: CompetitionType;
  logo?: string;
  currentSeasonId?: number;
}

export interface Season {
  id: number;
  competitionId: number;
  label: string;
  year: number;
  isCurrent: boolean;
}

export interface Team {
  id: number;
  slug: string;
  name: string;
  shortName?: string;
  country?: string;
  crest?: string;
  venueId?: number;
}

export interface Player {
  id: number;
  slug: string;
  name: string;
  position?: string;
  nationality?: string;
  teamId?: number;
  number?: number;
}

export interface Match {
  id: number;
  slug: string;
  competitionId: number;
  seasonYear: number;
  round?: string;
  kickoffUtc: string; // ISO 8601, UTC
  status: MatchStatus;
  minute?: number;
  homeTeamId: number;
  awayTeamId: number;
  homeScore?: number;
  awayScore?: number;
  /** Penalty-shootout score, set only when a knockout tie went to penalties. */
  homePenalty?: number;
  awayPenalty?: number;
  /** Winning team id per the provider (covers extra time and penalties); undefined for a draw/undecided. */
  winnerTeamId?: number;
  venueId?: number;
  refereeId?: number;
  attendance?: number;
  broadcaster?: string;
  // Denormalized convenience fields so cards can render without extra lookups.
  venueName?: string;
  city?: string;
  refereeName?: string;
  homeTeam?: Team;
  awayTeam?: Team;
  competition?: Pick<Competition, "id" | "slug" | "name" | "logo">;
}

export type MatchEventType =
  | "goal"
  | "own_goal"
  | "penalty"
  | "missed_penalty"
  | "assist"
  | "sub"
  | "yellow"
  | "red"
  | "var";

export interface MatchEvent {
  id: string;
  matchId: number;
  minute: number;
  extraMinute?: number;
  type: MatchEventType;
  teamId: number;
  playerId?: number;
  playerName?: string;
  relatedPlayerId?: number;
  relatedPlayerName?: string;
  detail?: string;
}

export interface LineupPlayer {
  playerId: number;
  name: string;
  number?: number;
  position?: string;
  gridRow?: number;
  gridCol?: number;
}

export interface Lineup {
  matchId: number;
  teamId: number;
  formation?: string;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
  coachName?: string;
}

export interface MatchStats {
  matchId: number;
  teamId: number;
  shots?: number;
  sot?: number;
  possession?: number;
  passes?: number;
  passAccuracy?: number;
  saves?: number;
  corners?: number;
  fouls?: number;
  offsides?: number;
  yellow?: number;
  red?: number;
  shotsInBox?: number;
  shotsOutBox?: number;
  blocked?: number;
  xg?: number;
  xgot?: number;
}

export interface Standing {
  competitionId: number;
  seasonYear: number;
  groupLabel: string | null;
  position: number;
  teamId: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  form: ("W" | "D" | "L")[];
  team?: Team;
}

export interface TopScorer {
  competitionId: number;
  seasonYear: number;
  playerId: number;
  teamId: number;
  goals: number;
  assists: number;
  rank: number;
  player?: Player;
  team?: Team;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  dek: string;
  image?: string;
  publishedAtUtc: string;
  sourceName: string;
  sourceUrl: string;
  body?: string; // stays empty in v1 — link-out only (section 11)
  competitionTags: string[];
  teamTags: string[];
  playerTags: string[];
}

export interface Venue {
  id: number;
  name: string;
  city?: string;
  country?: string;
  capacity?: number;
  surface?: string;
  image?: string;
}

export interface TeamProfile {
  team: Team;
  country?: string;
  founded?: number;
  venue?: Venue;
}

export interface Coach {
  id: number;
  name: string;
  age?: number;
  nationality?: string;
  photo?: string;
  teamName?: string;
}

export interface PlayerStatLine {
  appearances?: number;
  minutes?: number;
  goals?: number;
  assists?: number;
  yellow?: number;
  red?: number;
  rating?: number;
}

export interface PlayerProfile {
  player: Player;
  photo?: string;
  age?: number;
  height?: string;
  weight?: string;
  teamName?: string;
  teamId?: number;
  stats: PlayerStatLine;
}

/**
 * Pre-match 1X2 odds, NEUTRAL DATA ONLY (no betting CTAs/affiliate links —
 * CLAUDE.md section 17). Decimal prices; any field may be absent.
 */
/** One bookmaker's 1X2 prices (decimal). */
export interface BookmakerOdds {
  name: string;
  home?: number;
  draw?: number;
  away?: number;
}

export interface Odds {
  matchId: number;
  /** Up to five bookmakers, biggest European platforms first, for comparison. */
  books: BookmakerOdds[];
}

/** A completed (confirmed) player transfer between two clubs. */
export interface Transfer {
  playerId: number;
  playerName: string;
  /** ISO date the move was recorded. */
  date: string;
  /** Fee / nature of the deal as the provider reports it, e.g. "€ 50M", "Loan", "Free". */
  type?: string;
  from?: { id?: number; name?: string; crest?: string };
  to?: { id?: number; name?: string; crest?: string };
}

export interface TeamFixturesOptions {
  /** number of most recent finished fixtures */
  last?: number;
  /** number of upcoming fixtures */
  next?: number;
}

/**
 * The single interface every data source implements. apiFootball.ts is the
 * primary; footballDataOrg.ts is a Premier-League-only fallback stub selected
 * via the PROVIDER env var.
 */
export interface FootballProvider {
  readonly name: string;
  getLeagues(): Promise<Competition[]>;
  getCurrentSeason(competitionId: number): Promise<Season | undefined>;
  getFixturesByDate(dateIso: string): Promise<Match[]>;
  getFixturesByLeague(leagueId: number, season: number): Promise<Match[]>;
  getLiveFixtures(): Promise<Match[]>;
  getMatch(fixtureId: number): Promise<Match | undefined>;
  getEvents(fixtureId: number): Promise<MatchEvent[]>;
  getLineups(fixtureId: number): Promise<Lineup[]>;
  getStatistics(fixtureId: number): Promise<MatchStats[]>;
  getStandings(leagueId: number, season: number): Promise<Standing[]>;
  getTopScorers(leagueId: number, season: number): Promise<TopScorer[]>;
  getHeadToHead(team1Id: number, team2Id: number, limit?: number): Promise<Match[]>;
  getTeamFixtures(teamId: number, opts: TeamFixturesOptions): Promise<Match[]>;
  getOdds(fixtureId: number): Promise<Odds | undefined>;
  getTopAssists(leagueId: number, season: number): Promise<TopScorer[]>;
  getTeam(teamId: number): Promise<TeamProfile | undefined>;
  getSquad(teamId: number): Promise<Player[]>;
  getPlayer(playerId: number, season: number): Promise<PlayerProfile | undefined>;
  getCoach(coachId: number): Promise<Coach | undefined>;
  getVenue(venueId: number): Promise<Venue | undefined>;
  searchTeams(query: string): Promise<Team[]>;
  /** All teams competing in a league/season — used to scope search to the nine competitions. */
  getTeamsByLeague(leagueId: number, season: number): Promise<Team[]>;
  /** Completed transfers involving a team (players moving in and out). */
  getTeamTransfers(teamId: number): Promise<Transfer[]>;
}
