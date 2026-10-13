import type { Lineup, Match, MatchEvent } from "@/lib/providers/types";
import { escapeHtml, layout, SITE_URL } from "./index";

/**
 * Matchday email content (pure: data in, subject/html/text out — unit tested).
 * Pre-match: kickoff time and, once published, both starting XIs.
 * Result: final score (AET/pens), goalscorers, share card, Player of the Match vote.
 */

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const kickoffUk = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

function footer(unsubscribeUrl: string) {
  return `You follow this club on My Football Tracker. <a href="${unsubscribeUrl}" style="color:#a8adb5">Unsubscribe from matchday emails</a>`;
}

function button(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;margin:6px 8px 0 0;padding:10px 16px;border-radius:12px;background:#cdf24a;color:#0b0c0e;font-weight:700;font-size:14px;text-decoration:none">${escapeHtml(label)}</a>`;
}

export function preMatchEmail(clubName: string, m: Match, lineups: Lineup[], unsubscribeUrl: string): EmailContent {
  const home = m.homeTeam?.name ?? "Home";
  const away = m.awayTeam?.name ?? "Away";
  const url = `${SITE_URL}/match/${m.slug}?utm_source=email&utm_medium=matchday`;
  const xi = lineups.map((l) => {
    const team = l.teamId === m.homeTeamId ? home : away;
    const names = l.starters.map((p) => p.name).join(", ");
    return { team, formation: l.formation, names };
  });
  const lineupHtml = xi.length
    ? xi.map((x) => `<p style="margin:14px 0 4px;font-weight:700">${escapeHtml(x.team)}${x.formation ? ` (${escapeHtml(x.formation)})` : ""}</p><p style="margin:0;font-size:14px;color:#c9ccd1;line-height:1.5">${escapeHtml(x.names)}</p>`).join("")
    : `<p style="margin:14px 0 0;font-size:14px;color:#a8adb5">Line-ups aren't out yet. They'll be on the match page as soon as they are.</p>`;
  const subject = xi.length ? `${home} v ${away}: line-ups are in` : `${home} v ${away} kicks off soon`;
  return {
    subject,
    html: layout(
      `<p style="margin:0;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#a8adb5">${escapeHtml(m.competition?.name ?? "")} · ${escapeHtml(kickoffUk(m.kickoffUtc))} (UK)</p>
       <h1 style="margin:8px 0 6px;font-size:24px">${escapeHtml(home)} v ${escapeHtml(away)}</h1>
       ${lineupHtml}
       <p style="margin:18px 0 0">${button(url, "Follow it live")}</p>`,
      footer(unsubscribeUrl),
    ),
    text: `${home} v ${away} — ${m.competition?.name ?? ""}, ${kickoffUk(m.kickoffUtc)} (UK)\n\n${
      xi.length ? xi.map((x) => `${x.team}${x.formation ? ` (${x.formation})` : ""}: ${x.names}`).join("\n\n") : "Line-ups aren't out yet."
    }\n\nFollow it live: ${url}\n\nUnsubscribe: ${unsubscribeUrl}`,
  };
}

/** "Haaland 23', 67' (P)" per team; own goals credited to the side that benefits. */
export function scorersByTeam(m: Match, events: MatchEvent[]): { home: string[]; away: string[] } {
  const goals = events.filter((e) => e.type === "goal" || e.type === "penalty" || e.type === "own_goal");
  const sides = { home: new Map<string, string[]>(), away: new Map<string, string[]>() };
  for (const e of goals) {
    const scorerSide = e.teamId === m.homeTeamId ? "home" : "away";
    const side = e.type === "own_goal" ? (scorerSide === "home" ? "away" : "home") : scorerSide;
    const min = `${e.minute}${e.extraMinute ? `+${e.extraMinute}` : ""}'${e.type === "penalty" ? " (P)" : e.type === "own_goal" ? " (OG)" : ""}`;
    const name = e.playerName ?? "Unknown";
    const list = sides[side].get(name) ?? sides[side].set(name, []).get(name)!;
    list.push(min);
  }
  const fmt = (map: Map<string, string[]>) => [...map].map(([n, mins]) => `${n} ${mins.join(", ")}`);
  return { home: fmt(sides.home), away: fmt(sides.away) };
}

export function resultEmail(clubName: string, m: Match, events: MatchEvent[], unsubscribeUrl: string): EmailContent {
  const home = m.homeTeam?.name ?? "Home";
  const away = m.awayTeam?.name ?? "Away";
  const score = `${m.homeScore ?? 0}–${m.awayScore ?? 0}`;
  const how =
    m.resultType === "pen" || (m.homePenalty != null && m.awayPenalty != null)
      ? `After penalties (${m.homePenalty}–${m.awayPenalty})`
      : m.resultType === "aet"
        ? "After extra time"
        : "Full time";
  const url = `${SITE_URL}/match/${m.slug}?utm_source=email&utm_medium=matchday`;
  const card = `${SITE_URL}/match/${m.slug}/card/story`;
  const vote = `${SITE_URL}/match/${m.slug}?tab=summary&utm_source=email&utm_medium=matchday`;
  const s = scorersByTeam(m, events);
  const scorersHtml = (list: string[]) => list.map((x) => escapeHtml(x)).join("<br>") || "&nbsp;";
  return {
    subject: `FT: ${home} ${score} ${away}`,
    html: layout(
      `<p style="margin:0;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#a8adb5">${escapeHtml(m.competition?.name ?? "")} · ${escapeHtml(how)}</p>
       <table role="presentation" width="100%" style="margin:12px 0 4px"><tr>
         <td style="font-size:18px;font-weight:700;width:40%">${escapeHtml(home)}</td>
         <td style="font-size:34px;font-weight:800;text-align:center;color:#cdf24a;white-space:nowrap">${escapeHtml(score)}</td>
         <td style="font-size:18px;font-weight:700;text-align:right;width:40%">${escapeHtml(away)}</td>
       </tr><tr>
         <td style="font-size:13px;color:#c9ccd1;vertical-align:top">${scorersHtml(s.home)}</td><td></td>
         <td style="font-size:13px;color:#c9ccd1;text-align:right;vertical-align:top">${scorersHtml(s.away)}</td>
       </tr></table>
       <p style="margin:18px 0 0">${button(vote, "Vote Player of the Match")}${button(card, "Get the share card")}</p>
       <p style="margin:14px 0 0"><a href="${url}" style="color:#cdf24a;font-size:14px">Full match report, stats and line-ups</a></p>`,
      footer(unsubscribeUrl),
    ),
    text: `${how}: ${home} ${score} ${away}\n${s.home.length ? `${home}: ${s.home.join("; ")}\n` : ""}${
      s.away.length ? `${away}: ${s.away.join("; ")}\n` : ""
    }\nVote Player of the Match: ${vote}\nShare card: ${card}\nMatch report: ${url}\n\nUnsubscribe: ${unsubscribeUrl}`,
  };
}
