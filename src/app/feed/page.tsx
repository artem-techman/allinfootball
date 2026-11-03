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
 * embedded (never re-hosted). Clips autoplay as they scroll into view. Sample
 * clips show only in the keyless demo (no YOUTUBE_API_KEY).
 */
export default async function FeedPage() {
  const feed = await highlights.getFeed({ limit: 48 });
  // Sample clips only in the keyless demo: on the live site an empty feed (a
  // YouTube quota blip) must never be filled with made-up highlights.
  const toShow = feed.length > 0 ? feed : process.env.YOUTUBE_API_KEY ? [] : PREVIEW_HIGHLIGHTS;

  return (
    <AppShell>
      <header className="mb-3">
        <h1 className="text-section text-text-primary">Highlights</h1>
        <p className="mt-0.5 text-meta text-text-secondary">Official highlights, newest first.</p>
      </header>

      {toShow.length > 0 ? (
        <HighlightReel highlights={toShow} />
      ) : (
        <p className="rounded-card border border-hairline bg-card p-card text-meta text-text-secondary">
          New highlights land here shortly after full time. Check back after the next match.
        </p>
      )}
    </AppShell>
  );
}
