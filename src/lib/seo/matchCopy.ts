import type { Match, MatchEvent, Standing } from "@/lib/providers/types";

/**
 * Search-shaped copy for match pages. Pure (data in → strings out), unit tested.
 *
 * One URL per fixture for its whole life; the title and description change with
 * the match state, because people search differently before, during and after a
 * game ("PSG vs Barcelona kick off time" → "PSG Barcelona score" → "PSG Barcelona
 * goals"). The preview / report paragraphs give every match page unique written
 * content built from our own data — no AI, no copied text.
 */

const UK = "Europe/London";
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: UK, ...opts }).format(new Date(iso));
const dayMonth = (iso: string) => fmt(iso, { day: "numeric", month: "short" }); // "21 Oct"
const longDate = (iso: string) => fmt(iso, { weekday: "long", day: "numeric", month: "long" }); // "Tuesday 21 October"
const ukTime = (iso: string) => fmt(iso, { hour: "2-digit", minute: "2-digit", hour12: false }); // "20:00"
const names = (m: Match) => ({ home: m.homeTeam?.name ?? "Home", away: m.awayTeam?.name ?? "Away" });
const score = (m: Match) => `${m.homeScore ?? 0}–${m.awayScore ?? 0}`;
const minute = (e: MatchEvent) => `${e.minute}${e.extraMinute ? `+${e.extraMinute}` : ""}'`;

/** Meta title (absolute — no brand suffix, so the keywords fit Google's ~60 chars). */
export function seoMatchTitle(m: Match): string {
  const { home, away } = names(m);
  const comp = m.competition?.name ?? "";
  switch (m.status) {
    case "finished":
      return `${home} ${score(m)} ${away}: goals, highlights & stats | ${comp}`;
    case "live":
    case "ht":
      return `${home} ${score(m)} ${away} LIVE: score & updates | ${comp}`;
    case "postponed":
      return `${home} vs ${away} postponed | ${comp}`;
    case "scheduled":
      return `${home} vs ${away}: kick-off time, team news & lineups (${dayMonth(m.kickoffUtc)})`;
    default:
      return `${home} vs ${away} | ${comp}`;
  }
}

export function seoMatchDescription(m: Match): string {
  const { home, away } = names(m);
  const comp = m.competition?.name ?? "football";
  switch (m.status) {
    case "finished":
      return `${home} ${score(m)} ${away} in the ${comp} on ${longDate(m.kickoffUtc)}: goalscorers, official highlights, lineups, match stats and the updated table.`;
    case "live":
    case "ht":
      return `Follow ${home} vs ${away} live: score, goals, cards, lineups and stats as they happen in the ${comp}, updated every 30 seconds.`;
    case "scheduled":
      return `${home} vs ${away}, ${comp}, ${longDate(m.kickoffUtc)} at ${ukTime(m.kickoffUtc)} UK time: preview, form, head-to-head, team news and confirmed lineups.`;
    default:
      return `${home} vs ${away} in the ${comp}: fixture details, lineups, stats and head-to-head.`;
  }
}

/* ------------------------------- preview ---------------------------------- */

export interface PreviewInput {
  match: Match;
  homeForm: Match[]; // last results, newest first
  awayForm: Match[];
  h2h: Match[];
  table: Standing[];
}

/** "W", "D" or "L" for a team in a finished match. */
export function resultFor(m: Match, teamId: number): "W" | "D" | "L" | null {
  if (m.status !== "finished" || m.homeScore == null || m.awayScore == null) return null;
  const winner = m.winnerTeamId ?? (m.homeScore > m.awayScore ? m.homeTeamId : m.awayScore > m.homeScore ? m.awayTeamId : null);
  if (winner == null) return "D";
  return winner === teamId ? "W" : "L";
}

const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

export function previewText({ match: m, homeForm, awayForm, h2h, table }: PreviewInput): string[] {
  const { home, away } = names(m);
  const comp = m.competition?.name ?? "";
  const round = m.round ? ` (${m.round})` : "";
  const where = m.venueName ? ` at ${m.venueName}${m.city ? `, ${m.city}` : ""}` : "";
  const out: string[] = [
    `${home} host ${away} in the ${comp}${round} on ${longDate(m.kickoffUtc)}, kicking off at ${ukTime(m.kickoffUtc)} UK time${where}.`,
  ];

  const form = (list: Match[], id: number) => list.map((x) => resultFor(x, id)).filter(Boolean).slice(0, 5) as string[];
  const hf = form(homeForm, m.homeTeamId);
  const af = form(awayForm, m.awayTeamId);
  const wins = (f: string[]) => f.filter((x) => x === "W").length;
  if (hf.length && af.length) {
    out.push(
      `${home} come into the game with ${wins(hf)} win${wins(hf) === 1 ? "" : "s"} from their last ${hf.length} (${hf.join(" ")}), while ${away} have won ${wins(af)} of their last ${af.length} (${af.join(" ")}).`,
    );
  }

  const hr = table.find((r) => r.teamId === m.homeTeamId);
  const ar = table.find((r) => r.teamId === m.awayTeamId);
  if (hr && ar && (!hr.groupLabel || hr.groupLabel === ar.groupLabel)) {
    out.push(`In the table, ${home} sit ${ord(hr.position)} on ${hr.points} points and ${away} are ${ord(ar.position)} on ${ar.points}.`);
  }

  const past = h2h.filter((x) => x.status === "finished" && x.id !== m.id);
  if (past.length) {
    const hw = past.filter((x) => resultFor(x, m.homeTeamId) === "W").length;
    const aw = past.filter((x) => resultFor(x, m.awayTeamId) === "W").length;
    const d = past.length - hw - aw;
    const last = past[0];
    out.push(
      `Of their last ${past.length} meeting${past.length === 1 ? "" : "s"}, ${home} won ${hw}, ${away} won ${aw}${d ? ` and ${d} ended level` : ""}. Most recently, ${last.homeTeam?.name} ${score(last)} ${last.awayTeam?.name} (${fmt(last.kickoffUtc, { month: "long", year: "numeric" })}).`,
    );
  } else {
    out.push(`This will be the first competitive meeting between the two sides in our records.`);
  }
  out.push(`Confirmed lineups usually appear about an hour before kick-off and will show here as soon as they are announced.`);
  return out;
}

/* -------------------------------- report ---------------------------------- */

export function reportText(m: Match, events: MatchEvent[]): string[] {
  const { home, away } = names(m);
  const comp = m.competition?.name ?? "";
  const where = m.venueName ? ` at ${m.venueName}` : "";
  const h = m.homeScore ?? 0;
  const a = m.awayScore ?? 0;
  const pens = m.homePenalty != null && m.awayPenalty != null;
  const aet = m.resultType === "aet" || m.resultType === "pen" || pens;

  let lead: string;
  if (pens) {
    const winner = (m.homePenalty ?? 0) > (m.awayPenalty ?? 0) ? home : away;
    lead = `${home} and ${away} drew ${h}–${a} after extra time in the ${comp}${where} on ${longDate(m.kickoffUtc)}, with ${winner} going through ${Math.max(m.homePenalty!, m.awayPenalty!)}–${Math.min(m.homePenalty!, m.awayPenalty!)} on penalties.`;
  } else if (h === a) {
    lead = `${home} and ${away} drew ${h}–${a}${aet ? " after extra time" : ""} in the ${comp}${where} on ${longDate(m.kickoffUtc)}.`;
  } else {
    const [w, l, ws, ls] = h > a ? [home, away, h, a] : [away, home, a, h];
    const verb = ws - ls >= 3 ? "thrashed" : ws - ls === 1 ? "edged" : "beat";
    lead = `${w} ${verb} ${l} ${ws}–${ls}${aet ? " after extra time" : ""} in the ${comp}${where} on ${longDate(m.kickoffUtc)}.`;
  }
  const out = [lead];

  const goals = events
    .filter((e) => e.type === "goal" || e.type === "penalty" || e.type === "own_goal")
    .sort((x, y) => x.minute - y.minute || (x.extraMinute ?? 0) - (y.extraMinute ?? 0))
    .filter((e) => !(pens && e.minute >= 120 && e.type === "penalty")); // shootout kicks aren't goals
  if (goals.length) {
    const desc = (e: MatchEvent) => {
      const who = e.playerName ?? "Unknown";
      if (e.type === "own_goal") return `an own goal by ${who} (${minute(e)})`;
      return `${who} (${minute(e)}${e.type === "penalty" ? ", penalty" : ""})`;
    };
    const first = goals[0];
    const opened = first.type === "own_goal" ? `The opening goal was ${desc(first)}` : `${first.playerName ?? "Unknown"} opened the scoring${first.type === "penalty" ? " from the penalty spot" : ""} after ${first.minute} minutes`;
    const rest = goals.slice(1).map(desc);
    out.push(rest.length ? `${opened}, with further goals from ${list(rest)}.` : `${opened}, the only goal of the game.`);
  }

  const reds = events.filter((e) => e.type === "red" && e.playerName);
  if (reds.length) out.push(`${list(reds.map((e) => `${e.playerName} (${minute(e)})`))} ${reds.length === 1 ? "was" : "were"} sent off.`);
  out.push(`Scroll down for the full lineups, match stats and head-to-head record.`);
  return out;
}

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
