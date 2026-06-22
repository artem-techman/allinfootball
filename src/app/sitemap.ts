import type { MetadataRoute } from "next";
import { COMPETITIONS } from "@/lib/constants/competitions";

const SITE = "https://goodfootballcompany.com";

/**
 * Sitemap: only the low-cardinality, indexable pages — home, the calendar/news/
 * feed indexes, and the nine competition hubs (+ sub-pages). We intentionally do
 * NOT enumerate team/match/player pages (they're disallowed in robots and each
 * costs provider calls), and this function makes NO provider calls itself, so a
 * crawler fetching /sitemap.xml never touches the football API quota.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE}/matches`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE}/feed`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${SITE}/news`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
  ];

  for (const c of COMPETITIONS) {
    for (const tab of ["fixtures", "table", "scorers", "news"]) {
      entries.push({
        url: `${SITE}/competition/${c.slug}/${tab}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  }

  return entries;
}
