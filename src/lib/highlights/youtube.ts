import "server-only";

import { swr } from "@/lib/cache";
import { channelHandleEntries, handleAllowsEmbed } from "./channels";
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
  /** false for channels that block off-site embedding (FIFA/UEFA). */
  allowsEmbed: boolean;
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
            allowsEmbed: handleAllowsEmbed(handle),
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
  // Out-of-scope formats the official channels also post as "highlights".
  "full match",
  "partido completo",
  "women",
  "womens",
  "wsl",
  "uwcl",
  "futsal",
  "beach soccer",
  "efootball",
  "esports",
];

/** Youth / other-tournament markers: FIFA's channel posts ASEAN, AFC, U-17 … clips. */
const OTHER_TOURNAMENT = /\b(asean|afc|caf|concacaf|conmebol|club world cup|olympic|u-?1\d|u-?2[0-3]|youth)\b/i;

/** "2018/19", "2025-26": a season older than the current one is an archive upload. */
function isOldSeason(title: string, now = new Date()): boolean {
  const current = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  for (const m of title.matchAll(/\b(20\d\d)\s*[/-]\s*(\d\d)\b/g)) {
    const start = Number(m[1]);
    const end = Number(m[2]);
    if ((start + 1) % 100 === end && start < current) return true;
  }
  return false;
}

export function looksLikeHighlights(title: string): boolean {
  const t = title.toLowerCase();
  if (NON_HIGHLIGHT.some((w) => t.includes(w))) return false;
  // a scoreline (e.g. "3-1") or the word "highlights" marks a match reel
  return t.includes("highlight") || /\d\s*[-–]\s*\d/.test(t);
}

/** Archive / "old match" markers. The official channels re-upload old matches
 *  and compilations with a RECENT upload date, so they can't be filtered by date
 *  — only by title. NOTE: do NOT treat "classic" as old — Serie A brands its
 *  CURRENT highlights "CLASSIC HIGHLIGHTS …", so that word is noise, not a signal.
 *  The reliable signals are past-tournament years and goal compilations. */
const OLD_MARKERS =
  /\b(on this day|throwback|relived|rewind|retro|all[-\s][\w\s]*goals|every[-\s][\w\s]*goal|goal[-\s]?compilation|golazos?)\b/i;

/** A tournament tagged with a year from 1900–2025 is an archive clip (the current
 *  World Cup cycle is 2026). Matches e.g. "2010 FIFA World Cup" / "World Cup 2014". */
const OLD_TOURNAMENT_YEAR =
  /(?:19\d\d|20[01]\d|202[0-5])[^|]{0,25}(?:world cup|euro|copa)|(?:world cup|euro|copa)[^|]{0,25}(?:19\d\d|20[01]\d|202[0-5])/i;

export function isCurrentContent(title: string, now = new Date()): boolean {
  return !OLD_MARKERS.test(title) && !OLD_TOURNAMENT_YEAR.test(title) && !isOldSeason(title, now) && !OTHER_TOURNAMENT.test(title);
}

/** A clip from a World Cup channel only counts if its title says World Cup. */
export function belongsToChannelCompetition(title: string, slug: string): boolean {
  if (slug === "world-cup") return /world cup/i.test(title) && !/club world cup/i.test(title);
  return true;
}

/** Only clips uploaded within this many days — a "what's happening now" feed. */
const MAX_AGE_DAYS = 45;

/** Re-tag a clip's competition from its TITLE. Shared channels (notably @uefa,
 *  which posts Champions League, Europa League AND Nations League) would otherwise
 *  mislabel everything as the channel's default slug. Falls back to that default. */
function competitionFromTitle(title: string, fallback: string): string {
  const t = title.toLowerCase();
  if (/nations league/.test(t)) return "nations-league";
  if (/europa league|\buel\b/.test(t)) return "europa-league";
  if (/champions league|\bucl\b/.test(t)) return "champions-league";
  return fallback;
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
      if (!id || !title || !looksLikeHighlights(title) || !isCurrentContent(title)) continue;
      if (!belongsToChannelCompetition(title, channel.competitionSlug)) continue;
      out.push({
        id,
        title,
        channelTitle: channel.channelTitle,
        publishedAtUtc: s?.publishedAt ?? new Date().toISOString(),
        thumbnailUrl: s?.thumbnails?.high?.url ?? s?.thumbnails?.medium?.url ?? THUMB(id),
        watchUrl: WATCH(id),
        competitionSlug: competitionFromTitle(title, channel.competitionSlug),
        embeddable: channel.allowsEmbed, // downgraded further by annotateEmbeddable
      });
    }
    return out;
  });
}

/* ------------------------------ embeddability ------------------------------ */

interface RawVideoStatus {
  items?: { id: string; status?: { embeddable?: boolean } }[];
}

/**
 * Annotate each highlight with YouTube's `status.embeddable` so the Feed reel
 * knows which clips can autoplay inline (many official channels — FIFA et al. —
 * disable off-site embedding; those become tap-to-open posters). One videos.list
 * call per ≤50 ids = 1 quota unit, cached. Ids we can't resolve are left
 * optimistic (embeddable) rather than wrongly excluded.
 */
async function annotateEmbeddable(list: Highlight[]): Promise<Highlight[]> {
  if (!list.length) return list;
  const known = new Map<string, boolean>();
  const ids = list.map((h) => h.id);
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    try {
      const data = await ytGet<RawVideoStatus>(
        "videos",
        { part: "status", id: batch.join(",") },
        TTL.feed,
      );
      for (const it of data.items ?? []) known.set(it.id, it.status?.embeddable !== false);
    } catch {
      // batch failed → leave those ids optimistic (embeddable)
    }
  }
  // A channel-level block (embeddable already false) stays false; otherwise use
  // the API's answer, defaulting optimistic when the status call couldn't resolve.
  return list.map((h) => ({
    ...h,
    embeddable: h.embeddable === false ? false : known.has(h.id) ? known.get(h.id)! : true,
  }));
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

/** Words too common across club names to identify a team on their own. */
const GENERIC = new Set([
  "united", "city", "real", "madrid", "manchester", "athletic", "atletico", "sporting", "club",
  "inter", "borussia", "olympique", "racing", "deportivo", "union", "town", "county", "rovers",
  "wanderers", "albion", "hotspur", "saint", "st", "de", "la", "le", "del", "fc",
]);

/** Common short names used in highlight titles. */
const TEAM_ALIASES: Record<string, string[]> = {
  "manchester united": ["man utd", "man united"],
  "manchester city": ["man city"],
  "tottenham": ["spurs"],
  "paris saint germain": ["psg"],
  "barcelona": ["barca"],
  "atletico madrid": ["atleti"],
  "bayern munchen": ["bayern", "bayern munich"],
  "internazionale": ["inter"],
  "inter": ["inter milan"],
  "borussia dortmund": ["dortmund", "bvb"],
  "wolverhampton wanderers": ["wolves"],
  "nottingham forest": ["forest", "nott m forest"],
};

/** Where a team is named in a normalised title, or -1. */
function teamPosition(t: string, team: string): number {
  const n = normalize(team);
  if (!n) return -1;
  const needles = [n, ...(TEAM_ALIASES[n] ?? [])];
  // Distinctive words only: "Madrid" alone can't tell Real from Atlético.
  for (const w of n.split(" ")) if (w.length >= 4 && !GENERIC.has(w)) needles.push(w);
  let best = -1;
  for (const needle of needles) {
    const m = new RegExp(`(?:^| )${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: |$)`).exec(t);
    if (m && (best === -1 || m.index < best)) best = m.index;
  }
  return best;
}

/**
 * A title matches a fixture when both teams are named, home before away (the
 * reverse fixture is a different match), and — when we know the kickoff — the
 * clip was uploaded between kickoff and 72 hours after it.
 */
export function titleMatchesFixture(
  h: { title: string; publishedAtUtc: string },
  q: { home: string; away: string; dateIso?: string },
): boolean {
  const t = normalize(h.title);
  const hi = teamPosition(t, q.home);
  const ai = teamPosition(t, q.away);
  if (hi < 0 || ai < 0 || hi >= ai) return false;
  if (q.dateIso) {
    const ko = Date.parse(q.dateIso);
    const up = Date.parse(h.publishedAtUtc);
    if (Number.isFinite(ko) && Number.isFinite(up) && (up < ko || up > ko + 72 * 3_600_000)) return false;
  }
  return true;
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
      // Dedupe by video id AND by normalised title (the same reel re-posted).
      const byId = new Map<string, Highlight>();
      const titles = new Set<string>();
      for (const h of lists.flat()) {
        const key = normalize(h.title);
        if (byId.has(h.id) || titles.has(key)) continue;
        byId.set(h.id, h);
        titles.add(key);
      }
      // Strict newest-first (release order), and only recent uploads — no old ones.
      const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
      const merged = [...byId.values()]
        .filter((h) => new Date(h.publishedAtUtc).getTime() >= cutoff)
        .sort((a, b) => b.publishedAtUtc.localeCompare(a.publishedAtUtc))
        .slice(0, opts.limit ?? 24);
      // annotateEmbeddable preserves order; the feed stays strictly release-sorted.
      return annotateEmbeddable(merged);
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
      return candidates.find((h) => titleMatchesFixture(h, query));
    } catch {
      return undefined;
    }
  },
};
