import type { Match } from "@/lib/providers/types";

/**
 * Which side won the tie. Prefers the provider's winner flag (which accounts for
 * extra time and penalty shootouts), falling back to the regulation score.
 * Returns null for a draw or an undecided/in-progress match.
 */
export function matchWinner(m: Match): "home" | "away" | null {
  if (m.winnerTeamId != null) {
    if (m.winnerTeamId === m.homeTeamId) return "home";
    if (m.winnerTeamId === m.awayTeamId) return "away";
  }
  if (m.homeScore != null && m.awayScore != null) {
    if (m.homeScore > m.awayScore) return "home";
    if (m.awayScore > m.homeScore) return "away";
  }
  return null;
}

/** True when the tie was settled by a penalty shootout. */
export function hasShootout(m: Match): boolean {
  return m.homePenalty != null && m.awayPenalty != null;
}

/** The live clock as fans read it: "67'", "90+3'", or "LIVE" before the first tick. */
export function liveMinuteLabel(m: Pick<Match, "minute" | "extraMinute">): string {
  if (m.minute == null) return "LIVE";
  return m.extraMinute ? `${m.minute}+${m.extraMinute}'` : `${m.minute}'`;
}

/**
 * How far a match has progressed, as a sortable tuple: [phase, clock, goals].
 * Phase 0 = not started, 1 = in play (incl. half time), 2 = over (finished or
 * called off). Used to keep live views MONOTONIC: responses can arrive out of
 * order (different server instances, caches of different ages), and a reading
 * that is behind one we've already shown must never move the clock or score
 * backwards, or bring a finished match back to life.
 */
export function matchProgress(m: Match): [number, number, number] {
  const goals = (m.homeScore ?? 0) + (m.awayScore ?? 0);
  switch (m.status) {
    case "scheduled":
      return [0, 0, goals];
    case "ht":
      return [1, 45 * 100 + 99, goals]; // after any first-half added time, before 46'
    case "live":
      return [1, (m.minute ?? 0) * 100 + (m.extraMinute ?? 0), goals];
    default:
      return [2, 0, goals];
  }
}

/** Negative when `a` is behind `b`, 0 when level, positive when ahead. */
export function compareProgress(a: Match, b: Match): number {
  const pa = matchProgress(a);
  const pb = matchProgress(b);
  for (let i = 0; i < pa.length; i += 1) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

/**
 * Fold a live-poll response into what's on screen without ever going backwards.
 * Responses can arrive out of order — served by different server instances whose
 * caches are seconds apart — so:
 *  - a match reading BEHIND the one already shown is ignored (the clock and score
 *    never rewind: no 90' → 78' → 90' flicker);
 *  - once a match drops out of the live list (final whistle), a later response
 *    carrying an equal-or-older reading of it is a stale echo and is ignored, so
 *    an ended game can't bounce between "Live" and "Up next". Only a strictly
 *    newer reading (it really is still on) brings it back.
 * `authoritative` = false (a degraded response) may add or advance, never remove.
 * `lastSeen` and `ended` are the caller's memory across polls; mutated in place.
 */
export function mergeLive(
  shown: Match[] | null,
  incoming: Match[],
  lastSeen: Map<number, Match>,
  ended: Set<number>,
  authoritative = true,
): Match[] {
  const incomingIds = new Set(incoming.map((m) => m.id));
  const out: Match[] = [];
  if (authoritative) {
    for (const m of shown ?? []) if (!incomingIds.has(m.id)) ended.add(m.id);
  } else {
    for (const m of shown ?? []) if (!incomingIds.has(m.id)) out.push(m);
  }
  for (const m of incoming) {
    const prev = lastSeen.get(m.id);
    if (ended.has(m.id)) {
      if (!prev || compareProgress(m, prev) <= 0) continue;
      ended.delete(m.id);
    }
    const best = prev && compareProgress(m, prev) < 0 ? prev : m;
    lastSeen.set(m.id, best);
    out.push(best);
  }
  return out;
}
