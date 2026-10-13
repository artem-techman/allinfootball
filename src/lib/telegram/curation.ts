import type { Match, MatchEvent } from "@/lib/providers/types";
import type { Article } from "@/lib/providers/types";

/**
 * What the Telegram channel posts, and how it reads. Pure (no I/O) and unit
 * tested — the channel's editorial rules live here.
 *
 * Curated, not a firehose: a busy Saturday has ~28 matches and ~70 goals, which
 * would get the channel muted. A match is "important" if a big club or nation
 * plays, or it's a European / World Cup knockout tie.
 */

/** API-Football team ids. */
export const BIG_CLUBS = new Set([
  42, 50, 40, 33, 49, 47, 34, 66, // Arsenal, Man City, Liverpool, Man Utd, Chelsea, Spurs, Newcastle, Villa
  541, 529, 530, // Real Madrid, Barcelona, Atlético
  505, 489, 496, 492, 497, // Inter, Milan, Juventus, Napoli, Roma
  157, 165, 168, // Bayern, Dortmund, Leverkusen
  85, 81, // PSG, Marseille
  9568, 1605, 1616, // Inter Miami, LA Galaxy, LAFC
]);
export const BIG_NATIONS = new Set([10, 2, 9, 25, 768, 27, 1118, 1, 6, 26]); // ENG FRA ESP GER ITA POR NED BEL BRA ARG

const KNOCKOUT_COMPS = new Set([1, 2, 3]); // World Cup, Champions League, Europa League

export function isImportant(m: Match): boolean {
  if (BIG_CLUBS.has(m.homeTeamId) || BIG_CLUBS.has(m.awayTeamId)) return true;
  if (BIG_NATIONS.has(m.homeTeamId) || BIG_NATIONS.has(m.awayTeamId)) return true;
  const round = (m.round ?? "").toLowerCase();
  const knockout = /final|semi|quarter|round of|knockout|play-off/.test(round) && !/group|league stage|regular season/.test(round);
  return KNOCKOUT_COMPS.has(m.competitionId) && knockout;
}

export const SITE = "https://myfootballtracker.com";
const link = (m: Match, medium: string) => `${SITE}/match/${m.slug}?utm_source=telegram&utm_medium=${medium}`;

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const names = (m: Match) => ({ home: m.homeTeam?.name ?? "Home", away: m.awayTeam?.name ?? "Away" });

const ukTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** "Merino 23', 90+2' (P)" lists per side; own goals credited to the side that benefits. */
export function scorerLines(m: Match, events: MatchEvent[]): { home: string[]; away: string[] } {
  const out = { home: new Map<string, string[]>(), away: new Map<string, string[]>() };
  for (const e of events) {
    if (e.type !== "goal" && e.type !== "penalty" && e.type !== "own_goal") continue;
    const by = e.teamId === m.homeTeamId ? "home" : "away";
    const side = e.type === "own_goal" ? (by === "home" ? "away" : "home") : by;
    const min = `${e.minute}${e.extraMinute ? `+${e.extraMinute}` : ""}'${e.type === "penalty" ? " (P)" : e.type === "own_goal" ? " (OG)" : ""}`;
    const n = e.playerName ?? "Unknown";
    (out[side].get(n) ?? out[side].set(n, []).get(n)!).push(min);
  }
  const fmt = (x: Map<string, string[]>) => [...x].map(([n, mins]) => `${n} ${mins.join(", ")}`);
  return { home: fmt(out.home), away: fmt(out.away) };
}

export function resultCaption(m: Match, events: MatchEvent[]): string {
  const { home, away } = names(m);
  const how =
    m.resultType === "pen" || (m.homePenalty != null && m.awayPenalty != null)
      ? ` (${m.homePenalty}–${m.awayPenalty} pens)`
      : m.resultType === "aet"
        ? " (a.e.t.)"
        : "";
  const s = scorerLines(m, events);
  const scorers = [
    ...s.home.map((x) => `⚽ ${esc(x)} <i>(${esc(home)})</i>`),
    ...s.away.map((x) => `⚽ ${esc(x)} <i>(${esc(away)})</i>`),
  ];
  return [
    `🏁 <b>FT: ${esc(home)} ${m.homeScore ?? 0}–${m.awayScore ?? 0} ${esc(away)}</b>${how}`,
    `<i>${esc(m.competition?.name ?? "")}</i>`,
    scorers.length ? `\n${scorers.join("\n")}` : "",
    `\n📊 <a href="${link(m, "result")}">Match report &amp; stats</a> · 🗳 <a href="${link(m, "vote")}&amp;tab=summary">Vote Player of the Match</a>`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function goalMessage(m: Match, scorer: MatchEvent | undefined): string {
  const { home, away } = names(m);
  const who = scorer?.playerName ? ` ${esc(scorer.playerName)}` : "";
  const min = scorer ? ` ${scorer.minute}${scorer.extraMinute ? `+${scorer.extraMinute}` : ""}'` : m.minute ? ` ${m.minute}'` : "";
  const tag = scorer?.type === "penalty" ? " (P)" : scorer?.type === "own_goal" ? " (OG)" : "";
  return `⚽ <b>GOAL!</b>${who}${min}${tag}\n<b>${esc(home)} ${m.homeScore ?? 0}–${m.awayScore ?? 0} ${esc(away)}</b>\n<i>${esc(m.competition?.name ?? "")}</i> · <a href="${link(m, "goal")}">Follow live</a>`;
}

export function disallowedMessage(m: Match): string {
  const { home, away } = names(m);
  return `❌ <b>Goal ruled out</b>\n<b>${esc(home)} ${m.homeScore ?? 0}–${m.awayScore ?? 0} ${esc(away)}</b> · <a href="${link(m, "goal")}">Follow live</a>`;
}

export function todayMessage(matches: Match[]): string {
  const lines = matches
    .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc))
    .map((m) => `${ukTime(m.kickoffUtc)}  ${esc(m.homeTeam?.name ?? "")} v ${esc(m.awayTeam?.name ?? "")} <i>· ${esc(m.competition?.name ?? "")}</i>`);
  return `📅 <b>Today's big games</b> (UK time)\n\n${lines.join("\n")}\n\n🔔 <a href="${SITE}/matches/today?utm_source=telegram&amp;utm_medium=today">All of today's matches</a>`;
}

export function highlightMessage(m: Match, url: string): string {
  const { home, away } = names(m);
  return `🎬 <b>Highlights: ${esc(home)} ${m.homeScore ?? 0}–${m.awayScore ?? 0} ${esc(away)}</b>\n${url}`;
}

/** Rank news: big clubs and competitions first; only fresh, tagged stories. */
export function newsScore(a: Article, now = Date.now()): number {
  const age = now - Date.parse(a.publishedAtUtc);
  if (!a.publishedAtUtc || !Number.isFinite(age) || age > 4 * 3600_000 || a.competitionTags.length === 0) return 0;
  const big = /arsenal|man(chester)? city|liverpool|man(chester)? (united|utd)|chelsea|tottenham|spurs|real madrid|barcelona|bayern|psg|inter|milan|juventus|messi|ronaldo|haaland|mbapp|champions league|world cup/i;
  return 1 + (big.test(a.title) ? 2 : 0) + (a.image ? 0.5 : 0) + a.competitionTags.length * 0.2;
}

export function newsMessage(a: Article): string {
  return `📰 <b>${esc(a.title)}</b>\n\n<a href="${a.sourceUrl}">Read at ${esc(a.sourceName)}</a>`;
}
