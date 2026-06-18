/**
 * Trustworthy football news sources (CLAUDE.md section 11). Official publisher
 * RSS only, link-out: we store/show headline, dek, image, source + time and link
 * to the original — never the full body. Chosen after verifying each feed
 * resolves and carries images: BBC (media:thumbnail), Guardian (media:content),
 * Sky (enclosure). 90min/ESPN were dropped (dead / no usable items).
 *
 * Override at runtime with NEWS_FEEDS="Name|url,Name|url" if a source changes.
 */
export interface FeedSource {
  name: string;
  url: string;
}

const DEFAULT_FEEDS: FeedSource[] = [
  { name: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/football/rss.xml" },
  { name: "The Guardian", url: "https://www.theguardian.com/football/rss" },
  { name: "Sky Sports", url: "https://www.skysports.com/rss/11095" },
];

export function getFeeds(): FeedSource[] {
  const override = process.env.NEWS_FEEDS;
  if (!override) return DEFAULT_FEEDS;
  const parsed = override
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, url] = entry.split("|");
      return name && url ? { name: name.trim(), url: url.trim() } : null;
    })
    .filter((f): f is FeedSource => f !== null);
  return parsed.length ? parsed : DEFAULT_FEEDS;
}
