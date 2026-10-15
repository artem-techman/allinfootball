import { describe, it, expect } from "vitest";
import { previewText, reportText, resultFor, seoMatchDescription, seoMatchTitle } from "@/lib/seo/matchCopy";
import type { Match, MatchEvent, Standing } from "@/lib/providers/types";

const m = (over: Partial<Match> = {}): Match => ({
  id: 9, slug: "paris-saint-germain-barcelona-9", competitionId: 2, seasonYear: 2026, round: "League Stage - 3",
  kickoffUtc: "2026-10-21T19:00:00Z", status: "scheduled", homeTeamId: 85, awayTeamId: 529,
  homeTeam: { id: 85, slug: "psg-85", name: "Paris Saint Germain" }, awayTeam: { id: 529, slug: "barcelona-529", name: "Barcelona" },
  competition: { id: 2, slug: "champions-league", name: "UEFA Champions League" }, venueName: "Parc des Princes", city: "Paris", ...over,
});
const res = (id: number, h: number, a: number, homeId: number, awayId: number): Match =>
  m({ id, status: "finished", homeScore: h, awayScore: a, homeTeamId: homeId, awayTeamId: awayId, kickoffUtc: "2025-04-16T19:00:00Z",
      homeTeam: { id: homeId, slug: "x", name: homeId === 85 ? "Paris Saint Germain" : "Barcelona" }, awayTeam: { id: awayId, slug: "y", name: awayId === 85 ? "Paris Saint Germain" : "Barcelona" } });

describe("match SEO copy", () => {
  it("titles follow the search intent of each state", () => {
    expect(seoMatchTitle(m())).toBe("Paris Saint Germain vs Barcelona: kick-off time, team news & lineups (21 Oct)");
    expect(seoMatchTitle(m({ status: "live", homeScore: 1, awayScore: 0 }))).toContain("1–0 Barcelona LIVE");
    expect(seoMatchTitle(m({ status: "finished", homeScore: 2, awayScore: 1 }))).toBe("Paris Saint Germain 2–1 Barcelona: goals, highlights & stats | UEFA Champions League");
  });
  it("descriptions carry UK kick-off time and land in Google's length range", () => {
    const d = seoMatchDescription(m());
    expect(d).toContain("20:00 UK time");
    expect(d.length).toBeGreaterThan(110);
    expect(d.length).toBeLessThan(175);
  });
  it("preview: venue, form, table and head-to-head in plain sentences", () => {
    const table = [
      { teamId: 85, position: 2, points: 9, groupLabel: null },
      { teamId: 529, position: 5, points: 7, groupLabel: null },
    ] as unknown as Standing[];
    const p = previewText({
      match: m(),
      homeForm: [res(1, 2, 0, 85, 1), res(2, 1, 1, 85, 2), res(3, 0, 1, 85, 3)],
      awayForm: [res(4, 3, 0, 529, 4)],
      h2h: [res(5, 1, 4, 85, 529), res(6, 2, 2, 529, 85)],
      table,
    }).join(" ");
    expect(p).toContain("at Parc des Princes, Paris");
    expect(p).toContain("1 win from their last 3 (W D L)");
    expect(p).toContain("sit 2nd on 9 points");
    expect(p).toContain("Paris Saint Germain won 0, Barcelona won 1 and 1 ended level");
  });
  it("report: winner, scorers in order, penalties and own goals named", () => {
    const ev = [
      { id: "a", matchId: 9, minute: 6, type: "penalty", teamId: 85, playerName: "Dembélé" },
      { id: "b", matchId: 9, minute: 70, type: "own_goal", teamId: 529, playerName: "Koundé" },
      { id: "c", matchId: 9, minute: 80, type: "goal", teamId: 529, playerName: "Yamal" },
      { id: "d", matchId: 9, minute: 85, type: "red", teamId: 529, playerName: "Gavi" },
    ] as MatchEvent[];
    const r = reportText(m({ status: "finished", homeScore: 2, awayScore: 1 }), ev).join(" ");
    expect(r).toContain("Paris Saint Germain edged Barcelona 2–1");
    expect(r).toContain("Dembélé opened the scoring from the penalty spot after 6 minutes");
    expect(r).toContain("an own goal by Koundé (70')");
    expect(r).toContain("Gavi (85') was sent off");
  });
  it("result helper respects the provider's winner flag (penalty shootouts)", () => {
    expect(resultFor(m({ status: "finished", homeScore: 1, awayScore: 1, winnerTeamId: 529 }), 85)).toBe("L");
    expect(resultFor(m({ status: "finished", homeScore: 1, awayScore: 1 }), 85)).toBe("D");
  });
});
