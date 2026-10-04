/**
 * Cache abstraction (CLAUDE.md section 3). v1 is an in-memory LRU with per-key
 * TTL; the Cache interface lets us swap in Redis later with no call-site change.
 *
 * Beyond plain get/set this also exposes:
 *  - getStale(): read the last-good value even after its TTL expired, so the
 *    adapter can serve stale data during a provider 429/5xx (section 10).
 *  - swr(): single-flight fetch with stale-while-revalidate semantics.
 */

export interface CacheEntry<T> {
  value: T;
  /** epoch ms when the entry becomes stale. */
  expiresAt: number;
  /** the TTL it was stored with, in ms. */
  ttlMs: number;
}

export interface Cache {
  get<T>(key: string): T | undefined;
  /** Returns the value even if expired (for last-good fallback). */
  getStale<T>(key: string): { value: T; isStale: boolean; staleForMs: number; ttlMs: number } | undefined;
  set<T>(key: string, value: T, ttlSeconds: number): void;
  delete(key: string): void;
  clear(): void;
}

class InMemoryLRUCache implements Cache {
  private store = new Map<string, CacheEntry<unknown>>();

  constructor(private maxEntries = 2000) {}

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) return undefined;
    // refresh recency
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value as T;
  }

  getStale<T>(key: string): { value: T; isStale: boolean; staleForMs: number; ttlMs: number } | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    const staleForMs = Date.now() - entry.expiresAt;
    return { value: entry.value as T, isStale: staleForMs > 0, staleForMs: Math.max(0, staleForMs), ttlMs: entry.ttlMs };
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000, ttlMs: ttlSeconds * 1000 });
    // Evict least-recently-used while over capacity.
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Module-level singleton. In Next.js dev the module graph is re-evaluated on
 * change, so we stash the instance on globalThis to survive HMR.
 */
const globalForCache = globalThis as unknown as { __allInFootballCache?: Cache };
export const cache: Cache = globalForCache.__allInFootballCache ?? new InMemoryLRUCache();
if (process.env.NODE_ENV !== "production") globalForCache.__allInFootballCache = cache;

/** Cache TTLs in seconds, per CLAUDE.md section 5. */
export const TTL = {
  // 30s (was 15): halves the upstream live=all spend after the 2026-07-10
  // quota exhaustion; scores still feel live.
  live: 30,
  /** The batched live-detail bundle (score, events, lineups, stats together). */
  liveDetail: 45,
  lineups: 60,
  /** Events/lineups/stats for matches outside the live window. */
  matchDetail: 60 * 60,
  standings: 15 * 60,
  fixtures: 120,
  /** A competition's whole-season fixture list (live state is overlaid on top). */
  seasonFixtures: 30 * 60,
  topScorers: 30 * 60,
  player: 6 * 60 * 60,
  odds: 3 * 60 * 60,
  h2h: 24 * 60 * 60,
  teams: 60 * 60 * 24,
  competitions: 60 * 60 * 24,
  news: 300,
  transfers: 60 * 60 * 6, // confirmed transfers change slowly; refresh a few times a day
} as const;

const inflight = new Map<string, Promise<unknown>>();

/**
 * Stale-while-revalidate fetch with single-flight de-duplication. Returns cached
 * fresh value immediately; on miss, fetches (coalescing concurrent callers); on
 * fetch error, falls back to the last-good stale value if one exists.
 */
/** Keys with at least this TTL may be refreshed in the background (see swr). */
const BACKGROUND_REFRESH_MIN_TTL_MS = 120_000;

export async function swr<T>(
  key: string,
  /** Seconds, or a function of the fetched value (e.g. a finished match keeps
   *  for hours, a live one for 30s). */
  ttlSeconds: number | ((value: T) => number),
  fetcher: () => Promise<T>,
): Promise<T> {
  const fresh = cache.get<T>(key);
  if (fresh !== undefined) return fresh;

  const refresh = () => {
    if (inflight.has(key)) return inflight.get(key) as Promise<T>;
    const p = (async () => {
      try {
        const value = await fetcher();
        cache.set(key, value, typeof ttlSeconds === "function" ? ttlSeconds(value) : ttlSeconds);
        return value;
      } catch (err) {
        const stale = cache.getStale<T>(key);
        if (stale) return stale.value; // serve last-good during provider failure
        throw err;
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, p);
    return p;
  };

  // Recently-expired, slow-moving data (news, tables, fixture lists — TTL of two
  // minutes or more) is served instantly while it refreshes in the background,
  // so a visitor never waits on a news feed or provider round-trip. Live data
  // (shorter TTL) and anything stale for longer than its own TTL still waits for
  // fresh — a first page view must never show an old score.
  const stale = cache.getStale<T>(key);
  if (stale && stale.ttlMs >= BACKGROUND_REFRESH_MIN_TTL_MS && stale.staleForMs <= stale.ttlMs) {
    refresh().catch(() => {});
    return stale.value;
  }
  return refresh();
}

