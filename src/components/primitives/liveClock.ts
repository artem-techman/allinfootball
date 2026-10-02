import type { Match } from "@/lib/providers/types";

/** Real time per interpolated minute. */
export const MINUTE_MS = 60_000;
/** Never run ahead of the provider by more than this many minutes. */
export const MAX_LEAD = 2;

/**
 * The last minute of the period `minute` falls in: 45 in the first half, 90 in
 * the second, 105/120 in extra time. The clock stops there until the provider
 * itself says the next period has started (46', 91', ...); null past 120' (a
 * shootout), where nothing should tick.
 */
export function periodCap(minute: number): number | null {
  if (minute <= 45) return 45;
  if (minute <= 90) return 90;
  if (minute <= 105) return 105;
  if (minute <= 120) return 120;
  return null;
}

/**
 * Interpolates the live clock between polls (N7): one minute per 60s of real
 * time since the provider's reading arrived, capped at the end of the period and
 * at provider + 2, and never below `floor` (the minute already on screen, so a
 * fresh-but-lagging reading can't step the clock back). Only a plain "live"
 * reading ticks: HT, finished, "LIVE" (no minute yet) and stoppage time
 * (extraMinute set — we don't invent added time) are returned as-is.
 */
export function tickMinute(
  m: Pick<Match, "status" | "minute" | "extraMinute">,
  elapsedMs: number,
  floor = 0,
): Pick<Match, "minute" | "extraMinute"> {
  const { minute, extraMinute } = m;
  if (m.status !== "live" || minute == null || extraMinute) return { minute, extraMinute };
  const cap = periodCap(minute);
  if (cap == null) return { minute, extraMinute };
  const advanced = minute + Math.max(0, Math.floor(elapsedMs / MINUTE_MS));
  const ceiling = Math.min(cap, minute + MAX_LEAD);
  return { minute: Math.min(Math.max(advanced, floor), ceiling), extraMinute };
}
