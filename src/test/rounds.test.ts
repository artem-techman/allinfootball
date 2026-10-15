import { describe, it, expect } from "vitest";
import { groupRounds, indexableRounds, roundLabel, roundSlug, roundSummary, roundTitle } from "@/lib/seo/rounds";
import { roundMessage } from "@/lib/telegram/curation";
import type { Match, MatchEvent } from "@/lib/providers/types";

const team = (id: number, name: string) => ({ id, slug: `${name.toLowerCase().replace(/ /g, "-")}-${id}`, name });
let nextId = 1;
const m = (round: string, ko: string, status: Match["status"], h?: number, a?: number, home = team(1, "Arsenal"), away = team(2, "Chelsea")): Match => ({
  id: nextId++, slug: `x-${nextId}`, competitionId: 39, seasonYear: 2026, round, kickoffUtc: ko, status,
  homeTeamId: home.id, awayTeamId: away.id, homeTeam: home, awayTeam: away, homeScore: h, awayScore: a,
  competition: { id: 39, slug: "premier-league", name: "Premier League" },
});

describe("round names", () => {
  it("reads like fans say it", () => {
    expect(roundLabel("premier-league", "Regular Season - 8")).toBe("Gameweek 8");
    expect(roundLabel("mls", "Regular Season - 30")).toBe("Matchweek 30");
    expect(roundLabel("champions-league", "League Stage - 3")).toBe("Matchday 3");
    expect(roundLabel("world-cup", "Group Stage - 2")).toBe("Group stage matchday 2");
    expect(roundLabel("nations-league", "League A - 5")).toBe("League A matchday 5");
    expect(roundLabel("world-cup", "Round of 16")).toBe("Round of 16");
    expect(roundSlug("premier-league", "Regular Season - 8")).toBe("gameweek-8");
    expect(roundSlug("world-cup", "Quarter-finals")).toBe("quarter-finals");
  });
});

describe("grouping rounds", () => {
  const season = [
    m("Regular Season - 1", "2026-08-15T14:00:00Z", "finished", 2, 0),
    m("Regular Season - 1", "2026-08-16T14:00:00Z", "finished", 1, 1),
    m("Regular Season - 2", "2026-08-22T14:00:00Z", "finished", 3, 1),
    m("Regular Season - 2", "2026-08-23T14:00:00Z", "postponed"), // doesn't hold the round-up back
    m("Regular Season - 3", "2026-08-29T14:00:00Z", "live", 0, 0),
    m("Regular Season - 3", "2026-08-30T14:00:00Z", "scheduled"),
    m("Regular Season - 4", "2026-09-12T14:00:00Z", "scheduled"),
    m("Regular Season - 5", "2026-09-19T14:00:00Z", "scheduled"),
    m("Regular Season - 6", "2026-09-26T14:00:00Z", "scheduled"),
  ];
  const rounds = groupRounds("premier-league", season);
  it("knows each round's state, in playing order", () => {
    expect(rounds.map((r) => [r.slug, r.state])).toEqual([
      ["gameweek-1", "complete"],
      ["gameweek-2", "complete"],
      ["gameweek-3", "in-progress"],
      ["gameweek-4", "upcoming"],
      ["gameweek-5", "upcoming"],
      ["gameweek-6", "upcoming"],
    ]);
    expect(rounds[2].index).toBe(2);
  });
  it("indexes what's played plus the next two rounds", () => {
    expect(indexableRounds(rounds).map((r) => r.slug)).toEqual(["gameweek-1", "gameweek-2", "gameweek-3", "gameweek-4", "gameweek-5"]);
  });
  it("titles follow the search intent of each state", () => {
    expect(roundTitle("Premier League", rounds[0], "2026/27")).toBe("Premier League gameweek 1 results 2026/27: scores, scorers & table");
    expect(roundTitle("Premier League", rounds[2], "2026/27")).toBe("Premier League gameweek 3: live scores, results & fixtures");
    expect(roundTitle("Premier League", rounds[3], "2026/27")).toContain("Premier League gameweek 4 fixtures: dates & kick-off times");
  });
});

describe("round-up copy", () => {
  it("summarises goals, the biggest win and multiple scorers", () => {
    const a = m("Regular Season - 9", "2026-10-18T14:00:00Z", "finished", 4, 0, team(1, "Arsenal"), team(2, "Chelsea"));
    const b = m("Regular Season - 9", "2026-10-18T16:30:00Z", "finished", 1, 1, team(3, "Everton"), team(4, "Fulham"));
    const [r] = groupRounds("premier-league", [a, b]);
    const ev = (id: number, playerId: number, playerName: string, minute: number): MatchEvent => ({ id: `${id}-${minute}`, matchId: id, minute, type: "goal", teamId: 1, playerId, playerName } as MatchEvent);
    const events = new Map([[a.id, [ev(a.id, 9, "Haaland", 10), ev(a.id, 9, "Haaland", 30), ev(a.id, 9, "Haaland", 60), ev(a.id, 7, "Saka", 80)]]]);
    const text = roundSummary("Premier League", r, events).join(" ");
    expect(text).toContain("Gameweek 9 is complete: 6 goals in 2 matches (3.0 a game), 1 draw and 0 away wins.");
    expect(text).toContain("The biggest win was Arsenal 4–0 Chelsea.");
    expect(text).toContain("Haaland (Arsenal) scored a hat-trick.");
  });
  it("Telegram post lists every score and links the round-up", () => {
    const a = m("Regular Season - 9", "2026-10-18T14:00:00Z", "finished", 2, 1);
    const msg = roundMessage("Premier League", "Gameweek 9", [a], "https://myfootballtracker.com/competition/premier-league/round/gameweek-9");
    expect(msg).toContain("Premier League: Gameweek 9 results");
    expect(msg).toContain("Arsenal <b>2–1</b> Chelsea");
    expect(msg).toContain("/round/gameweek-9?utm_source=telegram");
  });
});
