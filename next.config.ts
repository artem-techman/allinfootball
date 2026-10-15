import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Put <title>, description, canonical and social tags in <head> for EVERY
  // visitor. Next 15 otherwise streams them into <body> for most user agents
  // (Googlebot copes after rendering; Bing and simpler crawlers may not).
  htmlLimitedBots: /.*/,
  // The share-card routes read the Inter font files from disk at runtime.
  outputFileTracingIncludes: {
    "/match/[slug]/card/story": ["./src/lib/seo/fonts/*.ttf"],
    "/match/[slug]/card/square": ["./src/lib/seo/fonts/*.ttf"],
  },
  experimental: {
    // Fully prefetched pages (the sidebar links) are reused for 30s, not the
    // default 5 min, so a prefetched page never shows minutes-old scores.
    staleTimes: { static: 30 },
  },
  images: {
    // Crests and competition logos come from API-Football's media CDN.
    // News/player images come from RSS feeds (added in M4). Remote hosts are
    // allow-listed here; the FOOTBALL_API_KEY is never exposed to <Image>.
    remotePatterns: [
      { protocol: "https", hostname: "media.api-sports.io" },
      { protocol: "https", hostname: "media-*.api-sports.io" },
      // Stock football photography for preview/editorial imagery.
      { protocol: "https", hostname: "images.unsplash.com" },
      // YouTube video thumbnails for highlights (official-channel embeds only).
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
};

export default nextConfig;
