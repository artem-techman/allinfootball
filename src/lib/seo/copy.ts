import { COMPETITIONS } from "@/lib/constants/competitions";

/**
 * Copy derived from the competition list (B27): never hard-code "nine
 * competitions" or a hand-written list — both drift every time scope changes.
 */

/** "the Premier League, La Liga, …, MLS and the FIFA World Cup" style names. */
const DISPLAY_NAME: Record<string, string> = {
  "premier-league": "the Premier League",
  "champions-league": "the Champions League",
  "europa-league": "the Europa League",
  "nations-league": "the Nations League",
  "world-cup": "the FIFA World Cup",
};

/** Compact labels for tight spaces (OG image strap). */
const SHORT_NAME: Record<string, string> = {
  "champions-league": "UCL",
  "europa-league": "Europa",
  "nations-league": "Nations League",
  "world-cup": "World Cup",
};

export const COMPETITION_COUNT = COMPETITIONS.length;

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

/** "ten" (falls back to the digits past twelve). */
export function competitionCountWord(n: number = COMPETITION_COUNT): string {
  return WORDS[n] ?? String(n);
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Sentence-ready list: "the Premier League, La Liga, … and the FIFA World Cup". */
export function competitionListSentence(): string {
  return joinList(COMPETITIONS.map((c) => DISPLAY_NAME[c.slug] ?? c.name));
}

/** "Premier League · La Liga · … · World Cup" for the share image strap. */
export function competitionStrap(): string {
  return COMPETITIONS.map((c) => SHORT_NAME[c.slug] ?? c.name).join(" · ");
}
