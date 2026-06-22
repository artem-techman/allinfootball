import type { MetadataRoute } from "next";

/**
 * robots. Allow the low-cardinality, cacheable pages (home, the nine competition
 * hubs, news, feed) but DISALLOW the high-cardinality / unbounded ones that each
 * trigger fresh provider calls — the dated calendar (its prev/next links are an
 * infinite crawl space), individual matches, and entity pages. Crawling those
 * enumerates thousands of unique API calls and exhausts the daily quota. They
 * can be re-opened once they're served from ISR / a durable cache.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/matches/", // dated calendar — infinite prev/next crawl, one API call per date
        "/match/", // individual fixtures — ~8 API calls each
        "/team/",
        "/player/",
        "/coach/",
        "/referee/",
        "/stadium/",
        "/api/",
      ],
    },
    sitemap: "https://goodfootballcompany.com/sitemap.xml",
    host: "https://goodfootballcompany.com",
  };
}
