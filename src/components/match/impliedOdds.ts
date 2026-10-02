import type { BookmakerOdds } from "@/lib/providers/types";

export interface ImpliedSplit {
  home: number;
  draw: number;
  away: number;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * Market-implied 1X2 probabilities in whole percent, summing to exactly 100.
 * Per price list: 1/odds for each outcome, normalised to remove the margin;
 * then the median across lists (robust to one outlier), renormalised, rounded
 * by largest remainder. Lists missing an outcome or with a price ≤ 1 are
 * skipped; null when nothing usable is left.
 */
export function impliedSplit(books: BookmakerOdds[]): ImpliedSplit | null {
  const fair: ImpliedSplit[] = [];
  for (const b of books) {
    const { home, draw, away } = b;
    if (home == null || draw == null || away == null || home <= 1 || draw <= 1 || away <= 1) continue;
    const h = 1 / home;
    const d = 1 / draw;
    const a = 1 / away;
    const sum = h + d + a;
    fair.push({ home: h / sum, draw: d / sum, away: a / sum });
  }
  if (fair.length === 0) return null;

  const raw = {
    home: median(fair.map((f) => f.home)),
    draw: median(fair.map((f) => f.draw)),
    away: median(fair.map((f) => f.away)),
  };
  const total = raw.home + raw.draw + raw.away;
  const keys = ["home", "draw", "away"] as const;
  const exact = keys.map((k) => (raw[k] / total) * 100);
  const floored = exact.map(Math.floor);
  let left = 100 - floored.reduce((x, y) => x + y, 0);
  // Hand the leftover points to the largest fractional parts.
  const order = exact.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((x, y) => y.frac - x.frac);
  for (const { i } of order) {
    if (left <= 0) break;
    floored[i] += 1;
    left -= 1;
  }
  return { home: floored[0], draw: floored[1], away: floored[2] };
}
