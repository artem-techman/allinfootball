import type { Match, MatchEvent } from "@/lib/providers/types";
import { canonicalMatchSlug } from "./matchShare";
import { SITE_URL } from "./metadata";

/**
 * Pure helpers behind the result share cards (story 1080x1920, square
 * 1080x1080) and the match-page share sheet. No provider/DB/next-og imports, so
 * the client ShareSheet can use them and they are unit-testable
 * (src/test/share-card.test.ts).
 */

export type ShareCardFormat = "story" | "square";

export const SHARE_CARD_SIZES: Record<ShareCardFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

/** Where a share went — becomes `utm_medium` on the shared link. */
export type ShareChannel = "instagram" | "x" | "whatsapp" | "copy" | "native" | "download";

const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

/* ------------------------------------ scorers ------------------------------------ */

export interface ScorerLine {
  /** Player name as the provider spells it ("E. Haaland"). */
  name: string;
  /** Minutes in order, with markers: "23', 67' (P)", "90+2' (OG)". */
  minutes: string;
}

export interface ScorerSides {
  home: ScorerLine[];
  away: ScorerLine[];
  /** Scorers not shown because of `maxPerSide` (render as "+N more"). */
  homeMore: number;
  awayMore: number;
}

const GOAL_TYPES = new Set<MatchEvent["type"]>(["goal", "penalty", "own_goal"]);

/** "23'", "90+2'". */
export function formatMinute(e: Pick<MatchEvent, "minute" | "extraMinute">): string {
  return e.extraMinute ? `${e.minute}+${e.extraMinute}'` : `${e.minute}'`;
}

function marker(e: MatchEvent): string {
  if (e.type === "own_goal") return " (OG)";
  if (e.type === "penalty") return " (P)";
  return "";
}

/** Chronological sort key: 90+2 sorts after 90 and before 91. */
function timeKey(e: MatchEvent): number {
  return e.minute * 100 + (e.extraMinute ?? 0);
}

/** Order goals in time, keeping the provider's order for equal minutes. */
function chronological(goals: MatchEvent[]): MatchEvent[] {
  return goals
    .map((e, i) => ({ e, i }))
    .sort((a, b) => timeKey(a.e) - timeKey(b.e) || a.i - b.i)
    .map(({ e }) => e);
}

function groupByPlayer(goals: MatchEvent[]): ScorerLine[] {
  const groups = new Map<string, { name: string; events: MatchEvent[] }>();
  for (const e of goals) {
    const name = e.playerName?.trim() || "Goal";
    // Own goals are grouped separately from the same player's real goals (they
    // can't share a side anyway, but keep the key honest).
    const key = `${e.playerId ?? name.toLowerCase()}|${e.type === "own_goal" ? "og" : "g"}`;
    const g = groups.get(key);
    if (g) g.events.push(e);
    else groups.set(key, { name, events: [e] });
  }
  // Map insertion order follows the chronological input, so groups are ordered
  // by each player's first goal.
  return [...groups.values()].map((g) => ({
    name: g.name,
    minutes: g.events.map((e) => `${formatMinute(e)}${marker(e)}`).join(", "),
  }));
}

/**
 * Goalscorers for each side of a result card: grouped by player, ordered by
 * minute, penalties marked "(P)", own goals "(OG)" and listed under the team
 * they BENEFITED. When the tie went to a shootout, each side keeps only as many
 * goals as it scored in play — the provider files shootout kicks as 120'
 * penalties, which must not appear as goals.
 */
export function scorerSides(
  match: Pick<Match, "homeTeamId" | "awayTeamId" | "homeScore" | "awayScore" | "homePenalty" | "awayPenalty">,
  events: MatchEvent[],
  maxPerSide = 6,
): ScorerSides {
  const goals = chronological(events.filter((e) => GOAL_TYPES.has(e.type)));
  let home = goals.filter((e) => (e.type === "own_goal" ? e.teamId === match.awayTeamId : e.teamId === match.homeTeamId));
  let away = goals.filter((e) => (e.type === "own_goal" ? e.teamId === match.homeTeamId : e.teamId === match.awayTeamId));

  const shootout = match.homePenalty != null && match.awayPenalty != null;
  if (shootout) {
    if (match.homeScore != null) home = home.slice(0, match.homeScore);
    if (match.awayScore != null) away = away.slice(0, match.awayScore);
  }

  const homeLines = groupByPlayer(home);
  const awayLines = groupByPlayer(away);
  return {
    home: homeLines.slice(0, maxPerSide),
    away: awayLines.slice(0, maxPerSide),
    homeMore: Math.max(0, homeLines.length - maxPerSide),
    awayMore: Math.max(0, awayLines.length - maxPerSide),
  };
}

/* ------------------------------------- copy ------------------------------------- */

/** "FULL TIME" / "AFTER EXTRA TIME" / "AFTER PENALTIES (4–3)" — same rule as MatchHeader. */
export function resultStatusLine(m: Pick<Match, "homePenalty" | "awayPenalty" | "resultType">): string {
  const shootout = m.homePenalty != null && m.awayPenalty != null;
  if (shootout) return `AFTER PENALTIES (${m.homePenalty}–${m.awayPenalty})`;
  if (m.resultType === "pen") return "AFTER PENALTIES";
  if (m.resultType === "aet") return "AFTER EXTRA TIME";
  return "FULL TIME";
}

/** "Spain 2–1 Italy" (+ " (4–3 pens)" after a shootout). */
export function resultHeadline(m: Match): string {
  const home = m.homeTeam?.name ?? "Home";
  const away = m.awayTeam?.name ?? "Away";
  const score = m.homeScore != null && m.awayScore != null ? `${m.homeScore}–${m.awayScore}` : "vs";
  const pens = m.homePenalty != null && m.awayPenalty != null ? ` (${m.homePenalty}–${m.awayPenalty} pens)` : "";
  return `${home} ${score} ${away}${pens}`;
}

/** Post text: "Spain 2–1 Italy · UEFA Nations League ⚽ via myfootballtracker.com". */
export function shareText(m: Match): string {
  const comp = m.competition?.name ? ` · ${m.competition.name}` : "";
  return `${resultHeadline(m)}${comp} ⚽ via ${SITE_HOST}`;
}

/* ------------------------------------- urls ------------------------------------- */

export function matchPath(m: Match): string {
  return `/match/${canonicalMatchSlug(m, m.slug || String(m.id))}`;
}

/** Absolute match URL tagged with `utm_source=share&utm_medium=<channel>`. */
export function shareUrl(m: Match, channel: ShareChannel): string {
  return `${SITE_URL}${matchPath(m)}?utm_source=share&utm_medium=${channel}`;
}

/** Same-origin path of a share card image. */
export function cardPath(m: Match, format: ShareCardFormat): string {
  return `${matchPath(m)}/card/${format}`;
}

/** "spain-italy-2-1-story.png" */
export function cardFileName(m: Match, format: ShareCardFormat): string {
  const slug = canonicalMatchSlug(m, m.slug || String(m.id)).replace(/-\d+$/, "") || "match";
  const score = m.homeScore != null && m.awayScore != null ? `-${m.homeScore}-${m.awayScore}` : "";
  return `${slug}${score}-${format}.png`;
}

/** X (Twitter) compose intent; X renders the match page's own OG card from `url`. */
export function xIntentUrl(m: Match): string {
  const params = new URLSearchParams({ text: shareText(m), url: shareUrl(m, "x") });
  return `https://x.com/intent/post?${params.toString()}`;
}

/** WhatsApp click-to-chat with the text + link prefilled. */
export function whatsappUrl(m: Match): string {
  return `https://wa.me/?text=${encodeURIComponent(`${shareText(m)}\n${shareUrl(m, "whatsapp")}`)}`;
}

/* ------------------------------------ helpers ------------------------------------ */

/** "RM" for Real Madrid, "AR" for Arsenal — the crest fallback disc. */
export function teamInitials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !/^(fc|cf|sc|ac|afc|the)$/i.test(w));
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return (words[0] ?? name).slice(0, 2).toUpperCase();
}

/** "Sat 11 Oct 2026" in UK time (the site's reference zone for shared copy). */
export function cardDateLabel(iso: string): string | undefined {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .format(d)
    .replace(",", "");
}

/** Truncate to `max` characters with an ellipsis. */
export function clip(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}
