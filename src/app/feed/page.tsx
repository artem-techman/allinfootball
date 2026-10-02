import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { HighlightReel } from "@/components/highlights/HighlightReel";
import { highlights } from "@/lib/highlights";
import { PREVIEW_HIGHLIGHTS } from "@/lib/preview/highlightsPreview";
import { buildMetadata } from "@/lib/seo/metadata";
import { competitionListSentence } from "@/lib/seo/copy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Feed — Match highlights",
  description: `Official match highlights from ${competitionListSentence()}, in one scrollable feed.`,
  path: "/feed",
});

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
        <p className="mt-0.5 text-meta text-text-secondary">Official highlights, newest first.</p>
      </header>

      <HighlightReel highlights={toShow} />
    </AppShell>
  );
}
