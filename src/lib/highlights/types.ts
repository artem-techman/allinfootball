/**
 * Domain types for video highlights. Like the football provider, the UI consumes
 * only these — never a raw YouTube API shape. Highlights are OFFICIAL embeds only
 * (CLAUDE.md section 17): we surface a YouTube video id from an allow-listed
 * official channel and embed it; we never host or re-upload video.
 */

export interface Highlight {
  /** YouTube video id. */
  id: string;
  title: string;
  channelTitle: string;
  publishedAtUtc: string;
  thumbnailUrl: string;
  /** YouTube watch URL — opened in a new tab (FIFA/official channels block
   *  off-site embedding, so we link out rather than show a blocked player). */
  watchUrl: string;
  /** which of the nine competitions this clip belongs to (channel-derived). */
  competitionSlug?: string;
}

export interface MatchHighlightQuery {
  home: string;
  away: string;
  /** kickoff ISO; used to bound the search window. */
  dateIso: string;
  competitionSlug?: string;
}

export interface HighlightsProvider {
  name: string;
  /** Recent highlights across the nine competitions, newest first (the Feed). */
  getFeed(opts?: { limit?: number; competitionSlug?: string }): Promise<Highlight[]>;
  /** Best official-highlights clip for one fixture, or undefined if none yet. */
  getMatchHighlight(query: MatchHighlightQuery): Promise<Highlight | undefined>;
}
