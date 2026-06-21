import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
