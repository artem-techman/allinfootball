import "server-only";
import { provider } from "@/lib/providers";
import type { Transfer } from "@/lib/providers/types";

/**
 * Confirmed-transfers feed for the Transfers page rail.
 *
 * API-Football's /transfers endpoint is per-team only (no league-wide query), so
 * pulling every club across the nine competitions would be ~180 calls per refresh
 * and blow the daily quota. We instead poll a curated set of the biggest European
 * clubs — where confirmed-transfer interest concentrates — and aggregate their
 * completed moves. Each /transfers call is cached in the provider (TTL.transfers
 * = 6h), so once warm the aggregation makes no new API calls. We deliberately do
 * NOT cache the combined result: a transient per-club failure would otherwise
 * poison the whole list until its TTL expired, whereas recombining each request
 * lets a failed club heal on the next visit.
 */

/** Top European clubs by transfer relevance (stable API-Football team ids). */
const TOP_CLUBS: number[] = [
  50, 33, 40, 42, 49, 47, // Man City, Man Utd, Liverpool, Arsenal, Chelsea, Tottenham
  541, 529, 530, // Real Madrid, Barcelona, Atlético Madrid
  496, 505, 489, 492, 497, // Juventus, Inter, AC Milan, Napoli, Roma
  157, 165, // Bayern Munich, Borussia Dortmund
  85, 81, // Paris SG, Marseille
];

const MAX_TRANSFERS = 20;

/** Start of the currently-relevant transfer window (UTC ISO date). Summer opens
 *  ~June, winter ~January; between windows we still surface the latest window. */
function windowStartIso(now: Date): string {
  const y = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1-12
  return month >= 6 ? `${y}-06-01` : `${y}-01-01`;
}

/** Normalise the provider's fee/type text; drop non-informative placeholders. */
function cleanType(type?: string): string | undefined {
  if (!type) return undefined;
  const t = type.trim();
  return t === "" || t.toUpperCase() === "N/A" ? undefined : t;
}

/**
 * Confirmed transfers completed in the current window across the curated clubs,
 * de-duplicated (a move shows up under both clubs' queries) and most-recent
 * first. Returns [] on any failure — the rail simply hides.
 */
export async function loadConfirmedTransfers(nowIso?: string): Promise<Transfer[]> {
  const now = nowIso ? new Date(nowIso) : new Date();
  const start = windowStartIso(now);

  const lists = await Promise.all(
    TOP_CLUBS.map((id) => provider.getTeamTransfers(id).catch(() => [] as Transfer[])),
  );

  const seen = new Set<string>();
  const out: Transfer[] = [];
  for (const t of lists.flat()) {
    // Only completed moves into a club, dated within the window.
    if (!t.to?.id || !t.date || t.date < start) continue;
    const key = `${t.playerId}|${t.date}|${t.to.id}|${t.from?.id ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...t, type: cleanType(t.type) });
  }

  out.sort((a, b) => b.date.localeCompare(a.date));
  return out.slice(0, MAX_TRANSFERS);
}
