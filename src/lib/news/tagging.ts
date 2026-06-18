import type { Article } from "@/lib/providers/types";
import { COMPETITION_KEYWORDS, TRANSFER_TERMS } from "./keywords";
import { articleSlug, type RawNewsItem } from "./rss";

/** Competition-name phrases (everything else in a list is treated as a club). */
const NAME_TERMS = new Set<string>([
  "premier league", "epl", "la liga", "laliga", "serie a", "bundesliga", "ligue 1",
  "champions league", "ucl", "uefa champions league", "europa league", "uel",
  "uefa europa league", "mls", "major league soccer", "world cup", "fifa world cup",
]);

export function isTransfer(a: { title: string; dek: string }): boolean {
  const hay = `${a.title} ${a.dek}`.toLowerCase();
  return TRANSFER_TERMS.some((t) => hay.includes(t));
}

/** Tag a raw item to competitions/clubs and shape it into our Article (no body). */
export function tagItem(raw: RawNewsItem): Article {
  const hay = `${raw.title} ${raw.dek}`.toLowerCase();
  const competitionTags = new Set<string>();
  const teamTags = new Set<string>();
  for (const comp of COMPETITION_KEYWORDS) {
    for (const term of comp.terms) {
      if (hay.includes(term)) {
        competitionTags.add(comp.slug);
        if (!NAME_TERMS.has(term)) teamTags.add(term);
      }
    }
  }
  const slug = articleSlug(raw.title);
  return {
    id: slug,
    slug,
    title: raw.title,
    dek: raw.dek,
    image: raw.image,
    publishedAtUtc: raw.publishedAtUtc,
    sourceName: raw.sourceName,
    sourceUrl: raw.link,
    body: "", // v1: link-out only — body stays empty (CLAUDE.md section 11)
    competitionTags: [...competitionTags],
    teamTags: [...teamTags],
    playerTags: [],
  };
}

/**
 * Dedupe (by normalised title — catches the same story across sources) + tag +
 * keep only items relevant to the nine competitions, newest first.
 */
export function aggregate(rawItems: RawNewsItem[]): Article[] {
  const seen = new Set<string>();
  const out: Article[] = [];
  for (const raw of rawItems) {
    const key = articleSlug(raw.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const article = tagItem(raw);
    if (article.competitionTags.length === 0) continue; // relevance filter
    out.push(article);
  }
  out.sort((a, b) => b.publishedAtUtc.localeCompare(a.publishedAtUtc));
  return out;
}
