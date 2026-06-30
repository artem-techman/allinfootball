import type { MetadataRoute } from "next";

/** Web app manifest — site identity for browsers, Android install, and crawlers. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "My Football Tracker",
    short_name: "Football Tracker",
    description:
      "Live football scores, tables, fixtures, lineups and stats across the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Europa League, MLS and the FIFA World Cup.",
    start_url: "/",
    display: "standalone",
    background_color: "#08090c",
    theme_color: "#08090c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
