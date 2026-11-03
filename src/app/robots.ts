import type { MetadataRoute } from "next";

/**
 * robots. Since 2026-10-15 match, matchday and team pages are open: robots get
 * SAVED data only (apiGet refuses provider requests for crawlers; finished
 * matches are archived, head-to-head and team profiles pre-saved by
 * /api/cron/seo), so crawling can't touch the API quota. Player pages opened
 * the same way (built from saved profiles). Still closed: the API and personal
 * pages. AI assistants get a map of the site at /llms.txt.
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
