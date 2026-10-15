import type { Article } from "@/lib/providers/types";
import { hasTerm } from "./tagging";

/**
 * Headlines about one club, for the "Team news" block on match previews. Pure
 * (articles in → articles out), unit tested. Matches the club's own name, the
 * name without its "FC"/"CF" decoration, and its common nicknames — on the
 * already-fetched RSS river, so it costs no requests of any kind.
 */

const strip = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Nicknames headline writers use instead of the official name. Keys are stripped official names. */
const NICKNAMES: Record<string, string[]> = {
  "paris saint germain": ["psg", "paris st germain"],
  "manchester united": ["man utd", "man united"],
  "manchester city": ["man city"],
  "tottenham": ["spurs"],
  "tottenham hotspur": ["spurs", "tottenham"],
  "wolverhampton wanderers": ["wolves"],
  "wolves": ["wolverhampton"],
  "barcelona": ["barca"],
  "atletico madrid": ["atletico", "atleti"],
  "bayern munchen": ["bayern munich", "bayern"],
  "borussia dortmund": ["dortmund", "bvb"],
  "borussia monchengladbach": ["gladbach", "monchengladbach"],
  "bayer leverkusen": ["leverkusen"],
  "inter": ["inter milan", "internazionale"],
  "ac milan": ["milan"],
  "juventus": ["juve"],
  "newcastle": ["newcastle united"],
  "brighton": ["brighton and hove albion", "brighton hove albion"],
  "nottingham forest": ["forest"],
  "west ham": ["west ham united"],
  "los angeles galaxy": ["la galaxy"],
  "inter miami": ["inter miami cf"],
};

/** Phrases that contain a needle but mean another club ("Inter Miami" isn't Inter). */
const NOT_THIS: Record<string, string[]> = {
  inter: ["inter miami"],
  milan: ["inter milan"],
  forest: ["forest green"],
  atletico: ["atletico mineiro", "atletico nacional"],
  sporting: ["sporting director", "sporting gijon"],
  rangers: ["queens park rangers"],
};

const DECORATION = /\b(fc|cf|afc|sc|ssc|as|ac|ss|cd|ud|sd|rc|rcd|vfb|vfl|tsg|sv|fk|sk|1)\b/g;

/** Every phrase that should count as a mention of this club. Exported for tests. */
export function teamNeedles(teamName: string): string[] {
  const full = strip(teamName);
  const bare = full.replace(DECORATION, " ").replace(/\s+/g, " ").trim();
  // Derived names need some length to be safe; curated nicknames ("psg") don't.
  const set = new Set([...[full, bare].filter((n) => n.length >= 4), ...(NICKNAMES[full] ?? []), ...(NICKNAMES[bare] ?? [])]);
  return [...set];
}

function mentions(hay: string, needle: string): boolean {
  let text = hay;
  for (const other of NOT_THIS[needle] ?? []) text = text.split(other).join(" ");
  return hasTerm(text, needle);
}

export function articlesForTeam(
  articles: Article[],
  teamName: string,
  opts: { limit?: number; maxAgeDays?: number; now?: number } = {},
): Article[] {
  const { limit = 3, maxAgeDays = 5, now = Date.now() } = opts;
  const needles = teamNeedles(teamName);
  if (!needles.length) return [];
  const oldest = now - maxAgeDays * 24 * 3600_000;
  const out: Article[] = [];
  for (const a of articles) {
    const at = Date.parse(a.publishedAtUtc);
    if (!Number.isFinite(at) || at < oldest) continue;
    const hay = strip(`${a.title} ${a.dek}`);
    if (needles.some((n) => mentions(hay, n))) out.push(a);
    if (out.length >= limit) break;
  }
  return out;
}

/** Headlines for both sides; a story about both clubs is shown once, under the home side. */
export function matchTeamNews(
  articles: Article[],
  home: string,
  away: string,
  opts: { limit?: number; maxAgeDays?: number; now?: number } = {},
): { home: Article[]; away: Article[] } {
  const homeList = articlesForTeam(articles, home, opts);
  const seen = new Set(homeList.map((a) => a.id));
  const awayList = articlesForTeam(
    articles.filter((a) => !seen.has(a.id)),
    away,
    opts,
  );
  return { home: homeList, away: awayList };
}
