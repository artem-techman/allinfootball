import type { Highlight } from "@/lib/highlights";

/**
 * Sample highlights to demonstrate the Feed / match Highlights tab before a
 * YOUTUBE_API_KEY is configured (same role as the other PREVIEW_* sets). Stock
 * thumbnails (Unsplash) keep it legally clean; the embeds are placeholders until
 * live data replaces them.
 */
const STOCK = (id: string) => `https://images.unsplash.com/${id}?w=640&q=70&auto=format&fit=crop`;

function h(
  id: string,
  title: string,
  channelTitle: string,
  competitionSlug: string,
  thumb: string,
  hoursAgo: number,
): Highlight {
  return {
    id,
    title,
    channelTitle,
    competitionSlug,
    thumbnailUrl: STOCK(thumb),
    watchUrl: `https://www.youtube.com/watch?v=${id}`,
    publishedAtUtc: new Date(Date.now() - hoursAgo * 3600_000).toISOString(),
  };
}

export const PREVIEW_HIGHLIGHTS: Highlight[] = [
  h("preview1", "France 3-1 Brazil | Extended Highlights | FIFA World Cup", "FIFA", "world-cup", "photo-1522778119026-d647f0596c20", 3),
  h("preview2", "Real Madrid 2-1 Barcelona | Highlights | LaLiga", "LaLiga", "la-liga", "photo-1543326727-cf6c39e8f84c", 6),
  h("preview3", "Bayern Munich 4-0 Dortmund | Highlights | Bundesliga", "Bundesliga", "bundesliga", "photo-1551958219-acbc608c6377", 9),
  h("preview4", "Inter 1-1 Juventus | Highlights | Serie A", "Serie A", "serie-a", "photo-1579952363873-27f3bade9f55", 14),
  h("preview5", "PSG 3-2 Marseille | Highlights | Ligue 1", "Ligue 1", "ligue-1", "photo-1574629810360-7efbbe195018", 20),
  h("preview6", "Inter Miami 2-1 LA Galaxy | Highlights | MLS", "MLS", "mls", "photo-1606925797300-0b35e9d1794e", 27),
];
