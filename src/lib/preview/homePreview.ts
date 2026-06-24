import type { Match, Standing } from "@/lib/providers/types";
import type { StoryItem } from "@/components/cards/TopStoriesCard";

/**
 * Sample home-dashboard content used to demonstrate the design before live data
 * is wired. Crests, league logos and player photos use API-Football's PUBLIC
 * media CDN (the same logo URLs the live adapter returns — no key required);
 * editorial/match imagery uses stock football photos. Isolated here so it swaps
 * for real provider data in M3.
 */

/** API-Football public media CDN (same source the live adapter uses). */
const TEAM = (id: number) => `https://media.api-sports.io/football/teams/${id}.png`;
const LEAGUE = (id: number) => `https://media.api-sports.io/football/leagues/${id}.png`;
const PLAYER = (id: number) => `https://media.api-sports.io/football/players/${id}.png`;
/** Stock football photography (Unsplash). */
const STOCK = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&q=75&auto=format&fit=crop`;

export const STOCK_IMAGES = {
  // Bernabéu at night — on-theme + dark-friendly for the hero.
  heroStadium: STOCK("photo-1522778119026-d647f0596c20", 1400),
  storyFeatured: STOCK("photo-1543326727-cf6c39e8f84c", 800),
  story1: STOCK("photo-1551958219-acbc608c6377", 300),
  story2: STOCK("photo-1606925797300-0b35e9d1794e", 300),
  story3: STOCK("photo-1579952363873-27f3bade9f55", 300),
  story4: STOCK("photo-1574629810360-7efbbe195018", 300),
  promo: STOCK("photo-1431324155629-1a6deb1dec8d", 400),
  avatar: STOCK("photo-1633332755192-727a05c4013d", 120),
};

function team(id: number, name: string, shortName: string) {
  return {
    id,
    slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${id}`,
    name,
    shortName,
    crest: TEAM(id),
  };
}

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

function comp(id: number, slug: string, name: string) {
  return { id, slug, name, logo: LEAGUE(id) };
}

function match(
  id: number,
  competition: { id: number; slug: string; name: string; logo: string },
  home: ReturnType<typeof team>,
  away: ReturnType<typeof team>,
  opts: Partial<Match> & { kickoffUtc: string },
): Match {
  return {
    id,
    slug: `${home.name}-${away.name}-${id}`.toLowerCase().replace(/\s+/g, "-"),
    competitionId: competition.id,
    seasonYear: 2025,
    homeTeamId: home.id,
    awayTeamId: away.id,
    status: "scheduled",
    homeTeam: home,
    awayTeam: away,
    competition,
    ...opts,
  };
}

const PL = comp(39, "premier-league", "Premier League");
const LL = comp(140, "la-liga", "La Liga");
const SA = comp(135, "serie-a", "Serie A");
const BL = comp(78, "bundesliga", "Bundesliga");
const L1 = comp(61, "ligue-1", "Ligue 1");

export const PREVIEW_UPCOMING: Match[] = [
  match(90001, PL, team(33, "Man United", "MUN"), team(49, "Chelsea", "CHE"), {
    kickoffUtc: hoursFromNow(20),
    round: "Matchday 37",
  }),
  match(90002, LL, team(529, "Barcelona", "BAR"), team(543, "Real Betis", "BET"), {
    kickoffUtc: hoursFromNow(44),
  }),
  match(90003, SA, team(496, "Juventus", "JUV"), team(505, "Inter", "INT"), {
    kickoffUtc: hoursFromNow(52),
  }),
  match(90004, BL, team(157, "Bayern Munich", "BAY"), team(165, "Dortmund", "DOR"), {
    kickoffUtc: hoursFromNow(56),
  }),
  match(90005, L1, team(85, "Paris SG", "PSG"), team(81, "Marseille", "MAR"), {
    kickoffUtc: hoursFromNow(68),
  }),
  match(90006, PL, team(42, "Arsenal", "ARS"), team(40, "Liverpool", "LIV"), {
    kickoffUtc: hoursFromNow(72),
  }),
  match(90007, LL, team(541, "Real Madrid", "RMA"), team(530, "Atletico Madrid", "ATM"), {
    kickoffUtc: hoursFromNow(90),
  }),
  match(90008, SA, team(492, "Napoli", "NAP"), team(497, "Roma", "ROM"), {
    kickoffUtc: hoursFromNow(96),
  }),
];

export const PREVIEW_RESULTS: Match[] = [
  match(92001, PL, team(42, "Arsenal", "ARS"), team(40, "Liverpool", "LIV"), {
    kickoffUtc: hoursFromNow(-3),
    status: "finished",
    homeScore: 2,
    awayScore: 1,
  }),
  match(92002, LL, team(541, "Real Madrid", "RMA"), team(529, "Barcelona", "BAR"), {
    kickoffUtc: hoursFromNow(-26),
    status: "finished",
    homeScore: 3,
    awayScore: 0,
  }),
  match(92003, SA, team(489, "AC Milan", "MIL"), team(505, "Inter", "INT"), {
    kickoffUtc: hoursFromNow(-49),
    status: "finished",
    homeScore: 1,
    awayScore: 1,
  }),
];

export const PREVIEW_LIVE: Match[] = [
  match(91001, PL, team(66, "Aston Villa", "AVL"), team(47, "Tottenham", "TOT"), {
    kickoffUtc: hoursFromNow(-1),
    status: "live",
    minute: 46,
    homeScore: 1,
    awayScore: 0,
  }),
  match(91002, SA, team(489, "AC Milan", "MIL"), team(499, "Atalanta", "ATA"), {
    kickoffUtc: hoursFromNow(-1),
    status: "ht",
    homeScore: 2,
    awayScore: 1,
  }),
  match(91003, LL, team(531, "Athletic Club", "ATH"), team(548, "Real Sociedad", "RSO"), {
    kickoffUtc: hoursFromNow(-1),
    status: "live",
    minute: 31,
    homeScore: 0,
    awayScore: 0,
  }),
];

function standing(
  position: number,
  id: number,
  name: string,
  short: string,
  played: number,
  gd: number,
  points: number,
): Standing {
  return {
    competitionId: 39,
    seasonYear: 2025,
    groupLabel: null,
    position,
    teamId: id,
    played,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    gd,
    points,
    form: [],
    team: { id, slug: short.toLowerCase(), name, shortName: name, crest: TEAM(id) },
  };
}

export const PREVIEW_STANDINGS: Standing[] = [
  standing(1, 42, "Arsenal", "ARS", 36, 61, 86),
  standing(2, 50, "Man City", "MCI", 36, 54, 82),
  standing(3, 40, "Liverpool", "LIV", 36, 43, 78),
  standing(4, 66, "Aston Villa", "AVL", 36, 20, 68),
  standing(5, 47, "Tottenham", "TOT", 36, 12, 60),
];

export const PREVIEW_STORIES: { featured: StoryItem; items: StoryItem[] } = {
  featured: {
    id: "s0",
    title: "Haaland breaks Premier League scoring record",
    href: "/news",
    publishedAtUtc: hoursFromNow(-2),
    tag: "Premier League",
    image: STOCK_IMAGES.storyFeatured,
  },
  items: [
    { id: "s1", title: "Liverpool keep title hopes alive with comeback win", href: "/news", publishedAtUtc: hoursFromNow(-3), image: STOCK_IMAGES.story1 },
    { id: "s2", title: "Bellingham: 'This team never stops believing'", href: "/news", publishedAtUtc: hoursFromNow(-5), image: STOCK_IMAGES.story2 },
    { id: "s3", title: "Xabi Alonso to leave Leverkusen at end of season", href: "/news", publishedAtUtc: hoursFromNow(-7), image: STOCK_IMAGES.story3 },
    { id: "s4", title: "Champions League final preview: tactical battle awaits", href: "/news", publishedAtUtc: hoursFromNow(-9), image: STOCK_IMAGES.story4 },
  ],
};

export const PREVIEW_SPOTLIGHT = {
  name: "Kylian Mbappé",
  club: "Real Madrid",
  position: "Forward",
  verified: true,
  matches: 42,
  goals: 38,
  assists: 10,
  portraitUrl: PLAYER(278),
};

/** World Cup top scorers (national-team crests as avatars — reliable without a key). */
export const PREVIEW_SCORERS = [
  { rank: 1, name: "Kylian Mbappé", href: "/competition/world-cup/scorers", team: "France", portraitUrl: TEAM(2), goals: 7, assists: 3 },
  { rank: 2, name: "Lionel Messi", href: "/competition/world-cup/scorers", team: "Argentina", portraitUrl: TEAM(26), goals: 6, assists: 4 },
  { rank: 3, name: "Vinícius Júnior", href: "/competition/world-cup/scorers", team: "Brazil", portraitUrl: TEAM(6), goals: 5, assists: 2 },
  { rank: 4, name: "Harry Kane", href: "/competition/world-cup/scorers", team: "England", portraitUrl: TEAM(10), goals: 5, assists: 1 },
  { rank: 5, name: "Pedri", href: "/competition/world-cup/scorers", team: "Spain", portraitUrl: TEAM(9), goals: 4, assists: 3 },
];

export const PREVIEW_HERO = {
  tag: "UCL Semi-Final",
  headline: "Madrid edge",
  headlineAccent: "closer to Wembley",
  dek: "A late Rodrygo goal gives Real Madrid the advantage in a thrilling first-leg battle at the Bernabéu.",
  imageUrl: STOCK_IMAGES.heroStadium,
  score: {
    compLabel: "UCL",
    homeName: "Real Madrid",
    awayName: "Bayern Munich",
    homeCrest: TEAM(541),
    awayCrest: TEAM(157),
    homeScore: 2,
    awayScore: 1,
    statusLabel: "Full Time",
  },
};
