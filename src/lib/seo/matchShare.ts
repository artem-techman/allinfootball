import type { Match } from "@/lib/providers/types";
import { entitySlug } from "@/lib/utils/slug";

/**
 * Pure helpers behind the match share card + match metadata (B6). Kept free of
 * provider/DB imports so they are unit-testable.
 */

const UK_TZ = "Europe/London";

export interface MatchShareText {
  competition: string;
  round?: string;
  home: string;
  away: string;
  /** Big centre text: "2 – 1" once a ball is kicked, else the kickoff time. */
  center: string;
  /** Small line under the centre text. */
  sub: string;
  /** "Sat 17 Oct · 15:00 UK time" (or "Kickoff time TBC"). */
  kickoffLabel: string;
}

function score(m: Match): string | undefined {
  if (m.homeScore == null || m.awayScore == null) return undefined;
  return `${m.homeScore} – ${m.awayScore}`;
}

function ukTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: UK_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(iso),
  );
}

function ukDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: UK_TZ, weekday: "short", day: "numeric", month: "short" }).format(
    new Date(iso),
  );
}

export function matchShareText(m: Match): MatchShareText {
  const home = m.homeTeam?.name ?? "Home";
  const away = m.awayTeam?.name ?? "Away";
  const competition = m.competition?.name ?? "Football";
  const s = score(m);
  const pens =
    m.homePenalty != null && m.awayPenalty != null ? ` · ${m.homePenalty}–${m.awayPenalty} on penalties` : "";
  const kickoffValid = !Number.isNaN(new Date(m.kickoffUtc).getTime());
  const kickoff = kickoffValid ? `${ukDate(m.kickoffUtc)} · ${ukTime(m.kickoffUtc)} UK time` : "Kickoff time TBC";

  let center: string;
  let sub: string;
  switch (m.status) {
    case "finished":
      center = s ?? "FT";
      sub = `Full time${pens}`;
      break;
    case "live":
      center = s ?? "LIVE";
      sub = m.minute != null ? `Live · ${m.minute}'` : "Live";
      break;
    case "ht":
      center = s ?? "HT";
      sub = "Half time";
      break;
    case "postponed":
      center = "vs";
      sub = "Postponed";
      break;
    case "cancelled":
      center = "vs";
      sub = "Cancelled";
      break;
    case "abandoned":
      center = s ?? "vs";
      sub = "Abandoned";
      break;
    case "suspended":
      center = s ?? "vs";
      sub = "Suspended";
      break;
    default:
      center = kickoffValid ? ukTime(m.kickoffUtc) : "vs";
      sub = kickoffValid ? `${ukDate(m.kickoffUtc)} · UK time` : kickoff;
  }
  return { competition, round: m.round, home, away, center, sub, kickoffLabel: kickoff };
}

/** "Arsenal vs Chelsea" */
export function matchTitle(m: Match): string {
  return `${m.homeTeam?.name ?? "Home"} vs ${m.awayTeam?.name ?? "Away"}`;
}

/** Share/meta description that reflects the match state. */
export function matchDescription(m: Match): string {
  const t = matchShareText(m);
  const comp = m.competition?.name ? ` in the ${m.competition.name}` : "";
  if (m.status === "finished" && m.homeScore != null && m.awayScore != null) {
    return `${t.home} ${m.homeScore}–${m.awayScore} ${t.away}${comp}: result, goals, lineups, stats and head-to-head.`;
  }
  if (m.status === "scheduled") {
    return `${t.home} vs ${t.away}${comp}, ${t.kickoffLabel}: lineups, form, head-to-head and live score.`;
  }
  return `${t.home} vs ${t.away}${comp}: live score, lineups, stats and head-to-head.`;
}

/** Canonical match slug (same rule the route uses to redirect stale slugs). */
export function canonicalMatchSlug(m: Match, fallbackSlug: string): string {
  if (m.homeTeam?.name && m.awayTeam?.name) return entitySlug(`${m.homeTeam.name}-${m.awayTeam.name}`, m.id);
  return fallbackSlug;
}
