/**
 * Allow-list of OFFICIAL YouTube channels per competition (CLAUDE.md section 17:
 * official embeds only). Highlights are only ever sourced from these channels, so
 * we never surface unofficial re-uploads. Channels are referenced by their
 * @handle and resolved to channel ids at runtime (handles are stable and easy to
 * verify); an unrecognised handle simply contributes no clips (graceful).
 *
 * NOTE: the Premier League does not post full match highlights on YouTube (those
 * rights sit with broadcasters), so its entry is intentionally sparse — it may
 * yield little until a licensed source is added.
 */
export const OFFICIAL_CHANNELS: Record<string, string[]> = {
  "world-cup": ["@fifaworldcup", "@FIFA"],
  "la-liga": ["@LaLiga"],
  bundesliga: ["@Bundesliga"],
  "serie-a": ["@SerieA"],
  "ligue-1": ["@Ligue1"],
  mls: ["@mlssoccer", "@MLS"],
  "champions-league": ["@uefa"],
  "europa-league": ["@uefa"],
  "premier-league": ["@premierleague"],
};

/** Flat, de-duplicated list of every handle → which competition slug it maps to. */
export function channelHandleEntries(): { handle: string; competitionSlug: string }[] {
  const seen = new Set<string>();
  const out: { handle: string; competitionSlug: string }[] = [];
  for (const [competitionSlug, handles] of Object.entries(OFFICIAL_CHANNELS)) {
    for (const handle of handles) {
      const key = handle.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ handle, competitionSlug });
    }
  }
  return out;
}
