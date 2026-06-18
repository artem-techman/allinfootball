/**
 * Curated keyword index for news tagging (CLAUDE.md section 11). Maps each of the
 * nine competitions to its name aliases + prominent clubs, so the river can keep
 * only items relevant to the nine competitions. Kept as data (no API calls) for
 * speed and predictability; extend the club lists over time.
 */

export interface CompetitionKeywords {
  slug: string;
  /** Lowercased phrases that imply this competition (name aliases + clubs). */
  terms: string[];
}

export const COMPETITION_KEYWORDS: CompetitionKeywords[] = [
  {
    slug: "premier-league",
    terms: [
      "premier league", "epl",
      "arsenal", "aston villa", "bournemouth", "brentford", "brighton", "burnley",
      "chelsea", "crystal palace", "everton", "fulham", "leeds", "liverpool",
      "manchester city", "man city", "manchester united", "man united", "man utd",
      "newcastle", "nottingham forest", "sunderland", "tottenham", "spurs", "west ham", "wolves",
    ],
  },
  {
    slug: "la-liga",
    terms: [
      "la liga", "laliga",
      "real madrid", "barcelona", "barca", "atletico madrid", "atletico", "athletic club",
      "sevilla", "real sociedad", "real betis", "villarreal", "valencia", "girona", "celta",
    ],
  },
  {
    slug: "serie-a",
    terms: [
      "serie a",
      "juventus", "inter milan", "inter", "ac milan", "milan", "napoli", "roma", "as roma",
      "lazio", "atalanta", "fiorentina", "bologna", "torino",
    ],
  },
  {
    slug: "bundesliga",
    terms: [
      "bundesliga",
      "bayern munich", "bayern", "borussia dortmund", "dortmund", "rb leipzig", "leipzig",
      "bayer leverkusen", "leverkusen", "eintracht frankfurt", "wolfsburg", "stuttgart",
    ],
  },
  {
    slug: "ligue-1",
    terms: [
      "ligue 1",
      "psg", "paris saint-germain", "paris saint germain", "marseille", "monaco", "lyon",
      "lille", "nice", "rennes", "lens",
    ],
  },
  {
    slug: "champions-league",
    terms: ["champions league", "ucl", "uefa champions league"],
  },
  {
    slug: "europa-league",
    terms: ["europa league", "uel", "uefa europa league"],
  },
  {
    slug: "mls",
    terms: [
      "mls", "major league soccer",
      "inter miami", "la galaxy", "lafc", "seattle sounders", "atlanta united", "new york red bulls",
    ],
  },
  {
    slug: "world-cup",
    terms: ["world cup", "fifa world cup"],
  },
];

/** Transfer-tagged news (the /news?tag=transfers filter + home rail). */
export const TRANSFER_TERMS = [
  "transfer", "signs", "signing", "signed", "joins", "join ", "deal", "bid", "loan",
  "fee", "agree", "agreed", "target", "linked", "swoop", "contract", "move to", "wants",
];
