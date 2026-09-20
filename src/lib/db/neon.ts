import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Neon (serverless Postgres) client for My Football Tracker.
 *
 * The app moved off Supabase (its free-tier project kept auto-pausing once the
 * two active-project slots were taken by other apps, which silently took the
 * raffle + match cache offline). Neon's free tier doesn't hard-pause — it
 * suspends idle compute and resumes on the next query — and it's a fine fit for
 * this app's light workload (a small raffle-leads table + two cache tables).
 *
 * Connection is server-side only via DATABASE_URL (the pooled Neon connection
 * string). The database is never exposed to the browser — only our route
 * handlers and server components query it — so there's no RLS/anon-key layer to
 * maintain, unlike Supabase's PostgREST. `db()` returns null when DATABASE_URL
 * is unset so every caller degrades gracefully instead of throwing.
 */

let cached: NeonQueryFunction<false, false> | null | undefined;

export function db(): NeonQueryFunction<false, false> | null {
  if (cached === undefined) {
    const url = process.env.DATABASE_URL;
    cached = url ? neon(url) : null;
  }
  return cached;
}

/** Guard any query so a slow/suspended database can never hang a page/request. */
export async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
