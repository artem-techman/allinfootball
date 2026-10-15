import type { Match, MatchEvent } from "@/lib/providers/types";
import { slugify } from "@/lib/utils/slug";

/**
 * Round pages: one URL per round of a competition for the whole season
 * ("/competition/premier-league/round/gameweek-8"). Before the round it's the
 * fixture list people search ("premier league gameweek 8 fixtures"); once it's
 * played it becomes the round-up ("gameweek 8 results"). Pure (fixtures in →
 * groups and copy out), unit tested; built from saved data only.
 */

export type RoundState = "upcoming" | "in-progress" | "complete";

export interface Round {
  /** Provider wording, e.g. "Regular Season - 8". */
  name: string;
  slug: string;
  label: string;
  matches: Match[];
  state: RoundState;
  startUtc: string;
  endUtc: string;
  /** Position in the season, for prev/next links. */
  index: number;
}

const NUM = /^(.*?)\s*-\s*(\d+)$/;

/** "Regular Season - 8" → "Gameweek 8" (MLS: "Matchweek 8"); "League Stage - 3" → "Matchday 3". */
export function roundLabel(compSlug: string, name: string): string {
  const m = NUM.exec(name.trim());
  if (!m) return name.trim();
  const [, stage, n] = m;
  if (/^regular season$/i.test(stage)) return compSlug === "mls" ? `Matchweek ${n}` : `Gameweek ${n}`;
  if (/^(league stage|league phase)$/i.test(stage)) return `Matchday ${n}`;
  if (/^group stage$/i.test(stage)) return `Group stage matchday ${n}`;
  return `${stage} matchday ${n}`; // "League A matchday 5" (Nations League)
}

export function roundSlug(compSlug: string, name: string): string {
  return slugify(roundLabel(compSlug, name));
}

const isOver = (m: Match) => m.status === "finished";
const isVoid = (m: Match) => m.status === "postponed" || m.status === "cancelled" || m.status === "abandoned";

/** Every round of a season, in playing order. */
export function groupRounds(compSlug: string, matches: Match[]): Round[] {
  const byName = new Map<string, Match[]>();
  for (const m of matches) {
    if (!m.round) continue;
    (byName.get(m.round) ?? byName.set(m.round, []).get(m.round)!).push(m);
  }
  const rounds: Round[] = [];
  for (const [name, list] of byName) {
    const sorted = [...list].sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc) || a.id - b.id);
    const counted = sorted.filter((m) => !isVoid(m));
    const done = counted.filter(isOver).length;
    // A round is complete when every match that's going ahead has finished
    // (a postponed game doesn't hold the round-up back).
    const state: RoundState = counted.length > 0 && done === counted.length ? "complete" : sorted.some((m) => m.status !== "scheduled" && !isVoid(m)) ? "in-progress" : "upcoming";
    rounds.push({
      name,
      slug: roundSlug(compSlug, name),
      label: roundLabel(compSlug, name),
      matches: sorted,
      state,
      startUtc: (counted[0] ?? sorted[0]).kickoffUtc,
      endUtc: (counted.at(-1) ?? sorted.at(-1)!).kickoffUtc,
      index: 0,
    });
  }
  // Playing order: by each round's median kick-off (a single rearranged game
  // months later mustn't drag its whole round to the end).
  const mid = (r: Round) => r.matches[Math.floor(r.matches.length / 2)].kickoffUtc;
  rounds.sort((a, b) => mid(a).localeCompare(mid(b)));
  rounds.forEach((r, i) => (r.index = i));
  return rounds;
}

/** Rounds worth a search result now: everything played or in play, plus the next two. */
export function indexableRounds(rounds: Round[]): Round[] {
  const firstUpcoming = rounds.findIndex((r) => r.state === "upcoming");
  if (firstUpcoming < 0) return rounds;
  return rounds.filter((r, i) => r.state !== "upcoming" || i < firstUpcoming + 2);
}

/* --------------------------------- copy ----------------------------------- */

const UK = "Europe/London";
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: UK, ...o }).format(new Date(iso));
const dayMonth = (iso: string) => fmt(iso, { weekday: "short", day: "numeric", month: "short" });
const ukTime = (iso: string) => fmt(iso, { hour: "2-digit", minute: "2-digit", hour12: false });
const score = (m: Match) => `${m.homeTeam?.name} ${m.homeScore ?? 0}–${m.awayScore ?? 0} ${m.awayTeam?.name}`;

export function dateRange(r: Round): string {
  const a = dayMonth(r.startUtc);
  const b = dayMonth(r.endUtc);
  return a === b ? a : `${a} – ${b}`;
}

export function roundTitle(compName: string, r: Round, season: string): string {
  const lc = r.label.charAt(0).toLowerCase() + r.label.slice(1);
  if (r.state === "complete") return `${compName} ${lc} results ${season}: scores, scorers & table`;
  if (r.state === "in-progress") return `${compName} ${lc}: live scores, results & fixtures`;
  return `${compName} ${lc} fixtures: dates & kick-off times (${dateRange(r)})`;
}

export function roundDescription(compName: string, r: Round): string {
  const n = r.matches.length;
  if (r.state === "complete") {
    const goals = r.matches.filter(isOver).reduce((s, m) => s + (m.homeScore ?? 0) + (m.awayScore ?? 0), 0);
    return `Every ${compName} ${r.label.toLowerCase()} result: ${n} matches, ${goals} goals, the scorers, the biggest wins and how the table looks now.`;
  }
  if (r.state === "in-progress") return `${compName} ${r.label.toLowerCase()} as it happens: live scores, results so far and kick-off times for the remaining matches.`;
  return `All ${n} ${compName} ${r.label.toLowerCase()} fixtures (${dateRange(r)}) with UK kick-off times, team news and previews.`;
}

/** Plain-sentence summary: a round-up once played, a look ahead before. */
export function roundSummary(compName: string, r: Round, events: Map<number, MatchEvent[]>): string[] {
  const out: string[] = [];
  const played = r.matches.filter(isOver);
  if (r.state === "upcoming") {
    const first = r.matches.find((m) => !isVoid(m)) ?? r.matches[0];
    out.push(
      `${compName} ${r.label.toLowerCase()} runs from ${fmt(r.startUtc, { weekday: "long", day: "numeric", month: "long" })} to ${fmt(r.endUtc, { weekday: "long", day: "numeric", month: "long" })}, with ${r.matches.length} matches. It starts with ${first.homeTeam?.name} v ${first.awayTeam?.name} at ${ukTime(first.kickoffUtc)} UK time.`,
    );
    return out;
  }
  if (!played.length) return out;

  const goals = played.reduce((s, m) => s + (m.homeScore ?? 0) + (m.awayScore ?? 0), 0);
  const draws = played.filter((m) => m.homeScore === m.awayScore).length;
  const awayWins = played.filter((m) => (m.awayScore ?? 0) > (m.homeScore ?? 0)).length;
  out.push(
    `${r.state === "complete" ? `${r.label} is complete` : `${played.length} of ${r.matches.length} ${r.label.toLowerCase()} matches have been played`}: ${goals} goal${goals === 1 ? "" : "s"} in ${played.length} match${played.length === 1 ? "" : "es"} (${(goals / played.length).toFixed(1)} a game), ${draws} draw${draws === 1 ? "" : "s"} and ${awayWins} away win${awayWins === 1 ? "" : "s"}.`,
  );

  const margin = (m: Match) => Math.abs((m.homeScore ?? 0) - (m.awayScore ?? 0));
  const biggest = [...played].sort((a, b) => margin(b) - margin(a) || (b.homeScore ?? 0) + (b.awayScore ?? 0) - ((a.homeScore ?? 0) + (a.awayScore ?? 0)))[0];
  const wildest = [...played].sort((a, b) => (b.homeScore ?? 0) + (b.awayScore ?? 0) - ((a.homeScore ?? 0) + (a.awayScore ?? 0)))[0];
  if (biggest && margin(biggest) >= 2) out.push(`The biggest win was ${score(biggest)}.`);
  if (wildest && wildest !== biggest && (wildest.homeScore ?? 0) + (wildest.awayScore ?? 0) >= 5) out.push(`The highest-scoring game was ${score(wildest)}.`);

  // Scorers across the round (own goals and shoot-out kicks don't count).
  const tally = new Map<string, { name: string; team?: string; goals: number }>();
  for (const m of played) {
    for (const e of events.get(m.id) ?? []) {
      if ((e.type !== "goal" && e.type !== "penalty") || !e.playerName) continue;
      if (e.type === "penalty" && e.minute >= 120 && m.homePenalty != null) continue;
      const team = e.teamId === m.homeTeamId ? m.homeTeam?.name : m.awayTeam?.name;
      const key = `${e.playerId ?? e.playerName}`;
      const row = tally.get(key) ?? { name: e.playerName, team, goals: 0 };
      row.goals += 1;
      tally.set(key, row);
    }
  }
  const multi = [...tally.values()].filter((t) => t.goals >= 2).sort((a, b) => b.goals - a.goals);
  if (multi.length) {
    const word = (g: number) => (g === 2 ? "twice" : g === 3 ? "a hat-trick" : `${g} goals`);
    const parts = multi.slice(0, 4).map((t) => `${t.name}${t.team ? ` (${t.team})` : ""} scored ${word(t.goals)}`);
    out.push(`${list(parts)}.`);
  }
  return out;
}

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
