import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { FeedGrid } from "@/components/highlights/FeedGrid";
import { highlights } from "@/lib/highlights";
import { PREVIEW_HIGHLIGHTS } from "@/lib/preview/highlightsPreview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Feed — Match highlights",
  description: "Post-match highlights from across the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Europa League, MLS and the World Cup.",
};

/**
 * Highlights Feed: a gallery of highlights from the latest finished games across
 * the nine competitions, sourced from official YouTube channels (link-out). Falls
 * back to preview clips until a YOUTUBE_API_KEY is configured.
 */
export default async function FeedPage() {
  const feed = await highlights.getFeed({ limit: 48 });
  const toShow = feed.length > 0 ? feed : PREVIEW_HIGHLIGHTS;

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-greeting text-text-primary">Highlights</h1>
        <p className="mt-1 text-meta text-text-secondary">
          Highlights from the latest finished games across the nine competitions.
        </p>
      </header>

      <FeedGrid highlights={toShow} />
    </AppShell>
  );
}
