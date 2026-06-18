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
}

export interface Cache {
  get<T>(key: string): T | undefined;
  /** Returns the value even if expired (for last-good fallback). */
  getStale<T>(key: string): { value: T; isStale: boolean } | undefined;
  set<T>(key: string, value: T, ttlSeconds: number): void;
  delete(key: string): void;
  clear(): void;
}

class InMemoryLRUCache implements Cache {
  private store = new Map<string, CacheEntry<unknown>>();

  constructor(private maxEntries = 500) {}

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) return undefined;
    // refresh recency
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value as T;
  }

  getStale<T>(key: string): { value: T; isStale: boolean } | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    return { value: entry.value as T, isStale: Date.now() > entry.expiresAt };
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
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
  live: 15,
  lineups: 60,
  standings: 120,
  fixtures: 120,
  topScorers: 300,
  teams: 60 * 60 * 24,
  competitions: 60 * 60 * 24,
  news: 300,
} as const;

const inflight = new Map<string, Promise<unknown>>();

/**
 * Stale-while-revalidate fetch with single-flight de-duplication. Returns cached
 * fresh value immediately; on miss, fetches (coalescing concurrent callers); on
 * fetch error, falls back to the last-good stale value if one exists.
 */
export async function swr<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const fresh = cache.get<T>(key);
  if (fresh !== undefined) return fresh;

  if (inflight.has(key)) return inflight.get(key) as Promise<T>;

  const p = (async () => {
    try {
      const value = await fetcher();
      cache.set(key, value, ttlSeconds);
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
}
