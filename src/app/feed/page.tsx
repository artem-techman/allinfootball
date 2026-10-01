import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { HighlightReel } from "@/components/highlights/HighlightReel";
import { highlights } from "@/lib/highlights";
import { PREVIEW_HIGHLIGHTS } from "@/lib/preview/highlightsPreview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Feed — Match highlights",
  description: "Match highlights from across the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Europa League, MLS, the UEFA Nations League and the World Cup — autoplaying in a scrollable feed.",
  alternates: { canonical: "/feed" },
};

/**
 * Highlights Feed: an Instagram/Reels-style vertical feed of match highlights
 * from the latest finished games, sourced from official YouTube channels and
 * embedded (never re-hosted). Clips autoplay as they scroll into view. Falls back
 * to preview clips until a YOUTUBE_API_KEY is configured.
 */
export default async function FeedPage() {
  const feed = await highlights.getFeed({ limit: 48 });
  const toShow = feed.length > 0 ? feed : PREVIEW_HIGHLIGHTS;

  return (
    <AppShell>
      <header className="mb-3">
        <h1 className="text-section text-text-primary">Highlights</h1>
        <p className="mt-0.5 text-meta text-text-secondary">Scroll the feed — clips play as you go.</p>
      </header>

      <HighlightReel highlights={toShow} />
    </AppShell>
  );
}
