import type { MatchStatus } from "./types";

/**
 * Maps API-Football fixture status short codes to our MatchStatus enum
 * (CLAUDE.md section 5). Every consumer must handle all enum values — render
 * postponed/cancelled/abandoned/suspended distinctly and NEVER show a live
 * minute for them (section 10).
 */
const STATUS_MAP: Record<string, MatchStatus> = {
  NS: "scheduled",
  TBD: "scheduled",
  "1H": "live",
  "2H": "live",
  ET: "live",
  P: "live",
  LIVE: "live",
  BT: "live", // break time (between ET halves) — still in play
  HT: "ht",
  FT: "finished",
  AET: "finished",
  PEN: "finished",
  PST: "postponed",
  CANC: "cancelled",
  ABD: "abandoned",
  SUSP: "suspended",
  INT: "suspended",
  AWD: "finished", // technical/awarded result
  WO: "finished", // walkover
};

export function mapStatus(short: string | undefined | null): MatchStatus {
  if (!short) return "scheduled";
  return STATUS_MAP[short] ?? "scheduled";
}

/** A live minute/pulse may only be shown for these statuses. */
export function isInPlay(status: MatchStatus): boolean {
  return status === "live" || status === "ht";
}

/** Match has a final result worth showing as a score. */
export function isFinished(status: MatchStatus): boolean {
  return status === "finished";
}
