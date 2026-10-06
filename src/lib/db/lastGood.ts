import "server-only";
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

export async function withLastGood<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  try {
    const value = await fetcher();
    await save(key, value);
    return value;
  } catch (err) {
    const saved = await load<T>(key);
    if (saved !== undefined) return saved;
    throw err;
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
        values (${key}, ${JSON.stringify(value)}::jsonb, now())
        on conflict (key) do update set body = excluded.body, fetched_at = excluded.fetched_at
      ` as unknown as Promise<unknown>,
      TIMEOUT_MS,
      undefined,
    );
  } catch {
    /* best-effort */
  }
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
    return rows[0]?.body;
  } catch {
    return undefined;
  }
}
