import "server-only";

import { youtubeHighlights } from "./youtube";
import type { HighlightsProvider } from "./types";

/**
 * Highlights provider selector. YouTube (official-channel embeds) is the only
 * source for now; the interface lets us swap in a dedicated highlights API later
 * without touching call sites. Import the `highlights` singleton server-side.
 */
export const highlights: HighlightsProvider = youtubeHighlights;

export type { Highlight, MatchHighlightQuery } from "./types";
