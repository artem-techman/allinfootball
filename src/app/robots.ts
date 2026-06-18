import type { MetadataRoute } from "next";

/** robots (CLAUDE.md section 13): allow all, point at the sitemap. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://allinfootball.com/sitemap.xml",
    host: "https://allinfootball.com",
  };
}
