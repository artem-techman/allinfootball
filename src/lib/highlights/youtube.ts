import "server-only";

import { swr } from "@/lib/cache";
import { channelHandleEntries } from "./channels";
import type { Highlight, HighlightsProvider, MatchHighlightQuery } from "./types";

/**
 * YouTube Data API v3 highlights adapter. Strategy (quota-conscious — see the
 * 2026-06-21 quota incident): resolve each official channel's "uploads" playlist
 * once a day (1 unit each), then read recent uploads via playlistItems (1 unit
 * each) — NOT search.list (100 units). The Feed is the merged highlight uploads;
 * a match's clip is found by matching both team names in those upload titles.
 * Everything is cached in Next's durable data cache so cold starts don't re-hit
 * the API. Degrades to [] when YOUTUBE_API_KEY is absent.
 */

const API = "https://www.googleapis.com/youtube/v3";

const TTL = {
  channels: 60 * 60 * 24, // resolved channel/uploads ids — rarely change
  feed: 60 * 60, // recent uploads — refresh hourly
} as const;

const WATCH = (id: string) => `https://www.youtube.com/watch?v=${id}`;
const THUMB = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

function hasKey(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

async function ytGet<T>(path: string, params: Record<string, string>, revalidate: number): Promise<T> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key);
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) throw new Error(`YouTube ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

/* ----------------------------- channel resolution ----------------------------- */

interface ResolvedChannel {
  channelId: string;
  uploadsPlaylistId: string;
  channelTitle: string;
  competitionSlug: string;
}

interface RawChannels {
  items?: {
    id: string;
    snippet?: { title?: string };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }[];
}

/** Resolve every allow-listed @handle to its uploads playlist. Cached 24h. */
async function resolveChannels(): Promise<ResolvedChannel[]> {
  return swr("yt:channels", TTL.channels, async () => {
    const out: ResolvedChannel[] = [];
    for (const { handle, competitionSlug } of channelHandleEntries()) {
      try {
        const data = await ytGet<RawChannels>(
          "channels",
          { part: "contentDetails,snippet", forHandle: handle },
          TTL.channels,
        );
        const item = data.items?.[0];
        const uploads = item?.contentDetails?.relatedPlaylists?.uploads;
        if (item && uploads) {
          out.push({
            channelId: item.id,
            uploadsPlaylistId: uploads,
            channelTitle: item.snippet?.title ?? handle,
            competitionSlug,
          });
        }
      } catch {
        // an unresolved handle just contributes nothing
      }
    }
    return out;
  });
}

/* ------------------------------- recent uploads ------------------------------- */

interface RawPlaylistItems {
  items?: {
    snippet?: {
      title?: string;
      publishedAt?: string;
      resourceId?: { videoId?: string };
      thumbnails?: Record<string, { url?: string }>;
    };
  }[];
}

/**
 * Heuristic: is this upload a match-highlights reel for a finished game? Official
 * channels title highlights either with the word "highlights" OR just the
 * scoreline (e.g. "France 3-1 Brazil | FIFA World Cup"), so we accept both — then
 * exclude the common non-match formats they also post (press conferences,
 * interviews, cartoon recaps, etc.).
 */
const NON_HIGHLIGHT = [
  "interview",
  "conference",
  "press",
  "reaction",
  "podcast",
  "preview",
  "powered by",
  "442oons",
  "trailer",
  "behind the scenes",
  "training",
  "documentary",
  "ceremony",
];

function looksLikeHighlights(title: string): boolean {
  const t = title.toLowerCase();
  if (NON_HIGHLIGHT.some((w) => t.includes(w))) return false;
  // a scoreline (e.g. "3-1") or the word "highlights" marks a match reel
  return t.includes("highlight") || /\d\s*[-–]\s*\d/.test(t);
}

async function uploadsFor(channel: ResolvedChannel): Promise<Highlight[]> {
  return swr(`yt:uploads:${channel.uploadsPlaylistId}`, TTL.feed, async () => {
    const data = await ytGet<RawPlaylistItems>(
      "playlistItems",
      { part: "snippet", playlistId: channel.uploadsPlaylistId, maxResults: "50" },
      TTL.feed,
    );
    const items = data.items ?? [];
    const out: Highlight[] = [];
    for (const it of items) {
      const s = it.snippet;
      const id = s?.resourceId?.videoId;
      const title = s?.title;
      if (!id || !title || !looksLikeHighlights(title)) continue;
      out.push({
        id,
        title,
        channelTitle: channel.channelTitle,
        publishedAtUtc: s?.publishedAt ?? new Date().toISOString(),
        thumbnailUrl: s?.thumbnails?.high?.url ?? s?.thumbnails?.medium?.url ?? THUMB(id),
        watchUrl: WATCH(id),
        competitionSlug: channel.competitionSlug,
      });
    }
    return out;
  });
}

/* ------------------------------- name matching ------------------------------- */

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|cf|afc|sc|ac|ss|us|cd|rc)\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A title matches a fixture if a distinctive token of BOTH teams appears in it. */
function titleMatchesTeams(title: string, home: string, away: string): boolean {
  const t = normalize(title);
  const present = (team: string) => {
    const n = normalize(team);
    if (!n) return false;
    if (t.includes(n)) return true;
    // fall back to the longest word (e.g. "United", "Madrid", "Bayern")
    const longest = n.split(" ").sort((a, b) => b.length - a.length)[0];
    return longest.length >= 4 && t.includes(longest);
  };
  return present(home) && present(away);
}

/* --------------------------------- provider --------------------------------- */

export const youtubeHighlights: HighlightsProvider = {
  name: "youtube",

  async getFeed(opts = {}): Promise<Highlight[]> {
    if (!hasKey()) return [];
    try {
      const channels = await resolveChannels();
      const wanted = opts.competitionSlug
        ? channels.filter((c) => c.competitionSlug === opts.competitionSlug)
        : channels;
      const lists = await Promise.all(wanted.map((c) => uploadsFor(c).catch(() => [] as Highlight[])));
      const byId = new Map<string, Highlight>();
      for (const h of lists.flat()) if (!byId.has(h.id)) byId.set(h.id, h);
      return [...byId.values()]
        .sort((a, b) => b.publishedAtUtc.localeCompare(a.publishedAtUtc))
        .slice(0, opts.limit ?? 24);
    } catch {
      return [];
    }
  },

  async getMatchHighlight(query: MatchHighlightQuery): Promise<Highlight | undefined> {
    if (!hasKey()) return undefined;
    try {
      // Search within the relevant competition's uploads first, then all.
      const pool = await this.getFeed({
        competitionSlug: query.competitionSlug,
        limit: 100,
      });
      const candidates = pool.length ? pool : await this.getFeed({ limit: 100 });
      return candidates.find((h) => titleMatchesTeams(h.title, query.home, query.away));
    } catch {
      return undefined;
    }
  },
};
