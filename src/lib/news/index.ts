import "server-only";

import { swr, TTL } from "@/lib/cache";
import type { Article } from "@/lib/providers/types";
import { getFeeds } from "./feeds";
import { fetchFeed } from "./rss";
import { aggregate, isTransfer } from "./tagging";

/**
 * News aggregation (CLAUDE.md section 11). Fetches the trusted feeds in parallel,
 * dedupes + tags to the nine competitions, caches for 5 minutes, and serves
 * link-out-only Articles. Server-side only.
 */
async function loadAll(): Promise<Article[]> {
  return swr("news:all", TTL.news, async () => {
    const feeds = getFeeds();
    const results = await Promise.all(feeds.map((f) => fetchFeed(f.url, f.name)));
    return aggregate(results.flat());
  });
}

export interface NewsQuery {
  /** competition slug to filter to */
  comp?: string;
  /** only transfer-tagged items */
  transfer?: boolean;
  limit?: number;
}

export async function getNews(query: NewsQuery = {}): Promise<Article[]> {
  let items = await loadAll();
  if (query.comp) items = items.filter((a) => a.competitionTags.includes(query.comp!));
  if (query.transfer) items = items.filter(isTransfer);
  if (query.limit) items = items.slice(0, query.limit);
  return items;
}

export async function getArticleBySlug(slug: string): Promise<Article | undefined> {
  const items = await loadAll();
  return items.find((a) => a.slug === slug);
}
