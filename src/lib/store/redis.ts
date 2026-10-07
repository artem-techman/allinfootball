import "server-only";

/**
 * Minimal Upstash Redis client over its REST API (no SDK — a single fetch per
 * command or pipeline). Upstash is the store the ingest worker writes and the
 * site reads: always on, pay per request, ~1 ms from the London functions.
 *
 * Configured by the Vercel Marketplace integration (either env naming).
 * `redis()` returns null when not configured, so callers fall back gracefully.
 */

type Arg = string | number;

export interface Redis {
  cmd<T = unknown>(...args: Arg[]): Promise<T>;
  /** Many commands in one round trip; results in order. */
  pipeline(commands: Arg[][]): Promise<unknown[]>;
}

let client: Redis | null | undefined;

export function redis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return (client = null);

  const call = async (path: string, body: unknown) => {
    const res = await fetch(`${url}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`redis ${res.status}`);
    return res.json();
  };

  client = {
    async cmd<T>(...args: Arg[]) {
      const data = (await call("", args)) as { result?: T; error?: string };
      if (data.error) throw new Error(`redis: ${data.error}`);
      return data.result as T;
    },
    async pipeline(commands: Arg[][]) {
      if (commands.length === 0) return [];
      const out: unknown[] = [];
      // Keep each request well under Upstash's request size limit.
      for (let i = 0; i < commands.length; i += 200) {
        const data = (await call("/pipeline", commands.slice(i, i + 200))) as { result?: unknown; error?: string }[];
        for (const r of data) {
          if (r.error) throw new Error(`redis: ${r.error}`);
          out.push(r.result);
        }
      }
      return out;
    },
  };
  return client;
}

/* ------------------------------ JSON helpers ------------------------------ */

export async function getJson<T>(r: Redis, key: string): Promise<T | null> {
  const raw = await r.cmd<string | null>("GET", key);
  return raw == null ? null : (JSON.parse(raw) as T);
}

export async function mgetJson<T>(r: Redis, keys: string[]): Promise<(T | null)[]> {
  if (keys.length === 0) return [];
  const out: (T | null)[] = [];
  for (let i = 0; i < keys.length; i += 500) {
    const raw = await r.cmd<(string | null)[]>("MGET", ...keys.slice(i, i + 500));
    for (const v of raw) out.push(v == null ? null : (JSON.parse(v) as T));
  }
  return out;
}
