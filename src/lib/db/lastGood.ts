import "server-only";
import { after } from "next/server";
import { readyDb, withTimeout } from "@/lib/db/neon";

/**
 * Last-good copies of slow-moving provider data (season fixture lists, tables,
 * top scorers) in our own database, shared by every server instance.
 *
 * The in-memory cache already serves last-good data on a provider failure — but
 * only on an instance that fetched it before. On 2026-10-06 the quota ran low,
 * the provider was (correctly) shed, and freshly started instances had nothing:
 * the home page rendered "Table not available" and no upcoming matches. With
 * this, any instance falls back to the last copy we ever stored.
 *
 * Writes are throttled per key (at most every WRITE_EVERY_MS per instance) and
 * every query is time-boxed, so the database never slows a page.
 */

const WRITE_EVERY_MS = 10 * 60_000;
const TIMEOUT_MS = 1_500;
const lastWrite = new Map<string, number>();

/** Values that came from the saved copy rather than the provider (see isSavedCopy). */
const savedCopies = new WeakSet<object>();

/** True when withLastGood answered with the saved copy (cache it briefly). */
export function isSavedCopy(value: unknown): boolean {
  return typeof value === "object" && value !== null && savedCopies.has(value);
}

async function loadSaved<T>(key: string): Promise<T | undefined> {
  const saved = await load<T>(key);
  if (typeof saved === "object" && saved !== null) savedCopies.add(saved);
  return saved;
}

/**
 * Provider data with a saved fallback. `preferSavedAfterMs`: if the provider
 * hasn't answered by then, answer from the saved copy and let the fetch finish
 * (and re-save) in the background. A brand-new server otherwise waited ~14s
 * for every season list before it could draw the home page (Oct 2026).
 */
export async function withLastGood<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: { preferSavedAfterMs?: number } = {},
): Promise<T> {
  const live = (async () => {
    const value = await fetcher();
    await save(key, value);
    return value;
  })();
  if (opts.preferSavedAfterMs) {
    live.catch(() => {}); // may finish after we've answered
    // ...but only if the function stays alive: Vercel freezes it once the page is
    // sent, so the refresh never landed and a slow list stayed on its saved copy
    // for hours (2026-11-01: this afternoon's games still "live" at 22:45).
    keepAlive(live);
    const first = await Promise.race([
      live.then((value) => ({ value })),
      new Promise<"slow">((resolve) => setTimeout(() => resolve("slow"), opts.preferSavedAfterMs)),
    ]).catch(() => "failed" as const);
    if (first !== "slow" && first !== "failed") return first.value;
    const saved = await loadSaved<T>(key);
    if (saved !== undefined) return saved;
    return live; // nothing saved yet: wait for the provider after all
  }
  try {
    return await live;
  } catch (err) {
    const saved = await loadSaved<T>(key);
    if (saved !== undefined) return saved;
    throw err;
  }
}

/** Let a promise finish after the response (next/server `after`); outside a
 *  request (cron jobs, tests) there's nothing to keep alive. */
function keepAlive(p: Promise<unknown>): void {
  try {
    after(() => p.catch(() => {}));
  } catch {
    /* not in a request scope */
  }
}

async function save(key: string, value: unknown): Promise<void> {
  // An empty answer (provider hiccup, off-season) must never replace a good copy.
  if (value == null || (Array.isArray(value) && value.length === 0)) return;
  const now = Date.now();
  if (now - (lastWrite.get(key) ?? 0) < WRITE_EVERY_MS) return;
  lastWrite.set(key, now);
  const sql = await readyDb(TIMEOUT_MS);
  if (!sql) return;
  try {
    await withTimeout(
      sql`
        insert into provider_cache (key, body, fetched_at)
        values (${key}, ${JSON.stringify(value)}::text::jsonb, now())
        on conflict (key) do update set body = excluded.body, fetched_at = excluded.fetched_at
      ` as unknown as Promise<unknown>,
      TIMEOUT_MS,
      undefined,
    );
  } catch {
    /* best-effort */
  }
}

/** The saved copy for a key, without ever calling the provider (pages that are
 *  built only from what the warm-up job stored: injuries, player profiles). */
export async function readLastGood<T>(key: string): Promise<T | undefined> {
  return load<T>(key);
}

async function load<T>(key: string): Promise<T | undefined> {
  const sql = await readyDb(TIMEOUT_MS);
  if (!sql) return undefined;
  try {
    const rows = await withTimeout(
      sql`select body from provider_cache where key = ${key}` as unknown as Promise<Array<{ body: T }>>,
      TIMEOUT_MS,
      [],
    );
    return asJson(rows[0]?.body) as T | undefined;
  } catch {
    return undefined;
  }
}

/** When each key was last saved (ms epoch), for the warm-up job's "is it fresh?" check. */
export async function lastGoodSavedAt(keys: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!keys.length) return out;
  const sql = await readyDb(TIMEOUT_MS);
  if (!sql) return out;
  try {
    const rows = (await sql`select key, fetched_at from provider_cache where key = any(${keys})`) as { key: string; fetched_at: string }[];
    for (const r of rows) out.set(r.key, Date.parse(r.fetched_at));
  } catch {
    /* treat as nothing saved */
  }
  return out;
}

/** Force a save regardless of the per-instance throttle (the warm-up job). */
export async function saveLastGood(key: string, value: unknown): Promise<void> {
  lastWrite.delete(key);
  await save(key, value);
}

/** Save many keys in ONE statement (a whole squad of player profiles). */
export async function saveLastGoodMany(entries: [key: string, value: unknown][]): Promise<void> {
  const rows = entries.filter(([, v]) => v != null && !(Array.isArray(v) && v.length === 0));
  if (!rows.length) return;
  const sql = await readyDb(TIMEOUT_MS);
  if (!sql) return;
  const keys = rows.map(([k]) => k);
  const bodies = rows.map(([, v]) => JSON.stringify(v));
  try {
    await sql`
      insert into provider_cache (key, body, fetched_at)
      select k, b::jsonb, now() from unnest(${keys}::text[], ${bodies}::text[]) as t(k, b)
      on conflict (key) do update set body = excluded.body, fetched_at = excluded.fetched_at
    `;
  } catch (err) {
    console.warn(`[lastGood] bulk save failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * JSON columns read back as values; a few rows written between 25 and 31 Oct
 * 2026 were stored as a JSON *string* (a driver quirk after the move to
 * Supabase), so decode those too. Exported for the match store.
 */
export function asJson(v: unknown): unknown {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}
