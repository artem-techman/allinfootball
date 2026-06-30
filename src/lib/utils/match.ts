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
