/**
 * SCOPE: exactly nine competitions (CLAUDE.md section 2). Nothing else ships
 * without explicit approval. League ids are API-Football ids and are stable
 * across seasons. Season convention: a season is its STARTING year, so
 * 2025/2026 === 2025. MLS and the World Cup are calendar-year leagues (2026).
 *
 * BUILD STEP ZERO (run once FOOTBALL_API_KEY is present, before building more
 * UI): call GET /leagues?search=MLS and GET /leagues?search=World Cup, confirm
 * the ids for MLS and World Cup, and overwrite the two `verified: false` entries
 * below. assertVerifiedLeagueIds() guards the seven already-verified ids at
 * startup. See verifyLeagueIds() in src/lib/providers/apiFootball.ts.
 */

export type CompetitionType = "league" | "cup" | "international";

export interface CompetitionConst {
  /** Our stable slug, used in URLs (/competition/[slug]). */
  slug: string;
  /** API-Football league id. */
  leagueId: number;
  name: string;
  country: string;
  type: CompetitionType;
  /** Fallback season (starting year). Live value comes from getCurrentSeason(). */
  defaultSeason: number;
  /** true once we have independently confirmed the id from the provider. */
  verified: boolean;
}

export const COMPETITIONS: readonly CompetitionConst[] = [
  { slug: "premier-league", leagueId: 39, name: "Premier League", country: "England", type: "league", defaultSeason: 2025, verified: true },
  { slug: "la-liga", leagueId: 140, name: "La Liga", country: "Spain", type: "league", defaultSeason: 2025, verified: true },
  { slug: "serie-a", leagueId: 135, name: "Serie A", country: "Italy", type: "league", defaultSeason: 2025, verified: true },
  { slug: "bundesliga", leagueId: 78, name: "Bundesliga", country: "Germany", type: "league", defaultSeason: 2025, verified: true },
  { slug: "ligue-1", leagueId: 61, name: "Ligue 1", country: "France", type: "league", defaultSeason: 2025, verified: true },
  { slug: "champions-league", leagueId: 2, name: "UEFA Champions League", country: "UEFA", type: "cup", defaultSeason: 2025, verified: true },
  { slug: "europa-league", leagueId: 3, name: "UEFA Europa League", country: "UEFA", type: "cup", defaultSeason: 2025, verified: true },
  // Confirmed via BUILD STEP ZERO against /leagues (2026-06-18): id 253 is
  // "Major League Soccer" (USA, current season 2026); id 1 is "World Cup" (current
  // season 2026). Note: searching "MLS" returns MLS All-Star/Next Pro, not the
  // main league — its API name is "Major League Soccer".
  { slug: "mls", leagueId: 253, name: "MLS", country: "USA", type: "league", defaultSeason: 2026, verified: true },
  { slug: "world-cup", leagueId: 1, name: "FIFA World Cup", country: "FIFA", type: "international", defaultSeason: 2026, verified: true },
] as const;

/** Default home competition (CLAUDE.md section 2). */
export const DEFAULT_COMPETITION_SLUG = "premier-league";

/** All nine ids we treat as ground truth; asserted at startup. */
export const VERIFIED_LEAGUE_IDS: Readonly<Record<string, number>> = {
  "premier-league": 39,
  "la-liga": 140,
  "serie-a": 135,
  "bundesliga": 78,
  "ligue-1": 61,
  "champions-league": 2,
  "europa-league": 3,
  mls: 253,
  "world-cup": 1,
};

const BY_SLUG = new Map(COMPETITIONS.map((c) => [c.slug, c]));
const BY_LEAGUE_ID = new Map(COMPETITIONS.map((c) => [c.leagueId, c]));

export function getCompetitionBySlug(slug: string): CompetitionConst | undefined {
  return BY_SLUG.get(slug);
}

export function getCompetitionByLeagueId(leagueId: number): CompetitionConst | undefined {
  return BY_LEAGUE_ID.get(leagueId);
}

/**
 * True for a competition's preliminary/qualifying phase. API-Football files
 * UCL/UEL qualifiers under the SAME league ids as the competition proper (2/3),
 * so in July the live feed fills up with 1st/2nd-qualifying-round minnows
 * (Kazakh sides, second-division cup entrants). Those rounds are out of product
 * scope — we track the competitions proper, not their qualification funnels.
 * NOTE: matches only "Qualifying"/"Preliminary" round names — the UCL's
 * main-phase "Knockout Round Play-offs" must NOT be excluded.
 */
export function isQualifyingRound(round?: string): boolean {
  return !!round && /qualif|preliminary/i.test(round);
}

export function isInScope(leagueId: number, round?: string): boolean {
  return BY_LEAGUE_ID.has(leagueId) && !isQualifyingRound(round);
}

export const LEAGUE_IDS: readonly number[] = COMPETITIONS.map((c) => c.leagueId);

/**
 * Startup assertion for the seven verified ids. Throws loudly if a constant has
 * been edited to drift from the known-good ids — cheap protection against a
 * typo silently fetching the wrong competition.
 */
export function assertVerifiedLeagueIds(): void {
  for (const [slug, expected] of Object.entries(VERIFIED_LEAGUE_IDS)) {
    const actual = BY_SLUG.get(slug)?.leagueId;
    if (actual !== expected) {
      throw new Error(
        `[competitions] league id drift for "${slug}": expected ${expected}, got ${actual}`,
      );
    }
  }
}
