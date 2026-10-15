import type { MetadataRoute } from "next";

/**
 * robots. Since 2026-10-15 match, matchday and team pages are open: robots get
 * SAVED data only (apiGet refuses provider requests for crawlers; finished
 * matches are archived, head-to-head and team profiles pre-saved by
 * /api/cron/seo), so crawling can't touch the API quota. Still closed: player
 * pages (one provider call per player, thousands of them), the API, and
 * personal pages.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/coach/", "/referee/", "/stadium/", "/api/", "/my-club", "/unsubscribe"],
    },
    sitemap: "https://myfootballtracker.com/sitemap.xml",
    host: "https://myfootballtracker.com",
  };
}
