import "server-only";
import { provider } from "@/lib/providers";
import { getCompetitionBySlug } from "@/lib/constants/competitions";
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
  50, 33, 40, 42, 49, 47, 66, // Man City, Man Utd, Liverpool, Arsenal, Chelsea, Tottenham, Aston Villa
  541, 529, 530, 531, 548, 543, // Real Madrid, Barcelona, Atlético, Athletic Club, Real Sociedad, Real Betis
  496, 505, 489, 492, 497, 499, // Juventus, Inter, AC Milan, Napoli, Roma, Atalanta
  157, 165, // Bayern Munich, Borussia Dortmund
  85, 81, // Paris SG, Marseille
];

const MAX_TRANSFERS = 20;

/** A player coming back to their parent club at the end of a loan — a squad
 *  admin record, not a signing anyone follows. Kept out of the widget. */
function isLoanReturn(type?: string): boolean {
  return !!type && /return/i.test(type);
}

/** Rank so marquee moves surface first: fees, then loans/frees, then the rest. */
function transferRank(type?: string): number {
  if (!type) return 2;
  if (/[€$£]|\d/.test(type)) return 0; // a fee
  if (/loan|free/i.test(type)) return 1;
  return 2;
}

/**
 * Start of the current season's transfer activity (UTC ISO date). Anchored to the
 * DOMESTIC season the site tracks (not the wall clock) — a season's squads are
 * built by its summer + winter windows, which open the June before it, so we
 * count everything from `${seasonYear}-06-01`. This keeps the widget populated
 * with the season's real confirmed deals rather than an almost-empty brand-new
 * calendar window.
 */
function windowStartIso(): string {
  const seasonYear = getCompetitionBySlug("premier-league")?.defaultSeason ?? new Date().getUTCFullYear();
  return `${seasonYear}-06-01`;
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
export async function loadConfirmedTransfers(): Promise<Transfer[]> {
  const start = windowStartIso();

  const lists = await Promise.all(
    TOP_CLUBS.map((id) => provider.getTeamTransfers(id).catch(() => [] as Transfer[])),
  );

  const seen = new Set<string>();
  const out: Transfer[] = [];
  for (const t of lists.flat()) {
    // Only completed moves into a club, dated within the window, that are actual
    // signings (loan returns are squad admin, not transfers).
    if (!t.to?.id || !t.date || t.date < start || isLoanReturn(t.type)) continue;
    const key = `${t.playerId}|${t.date}|${t.to.id}|${t.from?.id ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...t, type: cleanType(t.type) });
  }

  // Marquee (fee) moves first, then by most recent.
  out.sort((a, b) => transferRank(a.type) - transferRank(b.type) || b.date.localeCompare(a.date));
  return out.slice(0, MAX_TRANSFERS);
}
