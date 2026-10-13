import { describe, it, expect } from "vitest";
import { preMatchEmail, resultEmail, scorersByTeam } from "@/lib/email/matchday";
import { normalizeEmail } from "@/lib/auth";
import { voteOpen } from "@/lib/potm";
import type { Lineup, Match, MatchEvent } from "@/lib/providers/types";

const m = (over: Partial<Match> = {}): Match => ({
  id: 1, slug: "spain-italy-1", competitionId: 5, seasonYear: 2026, kickoffUtc: "2026-10-10T18:45:00Z",
  status: "finished", homeTeamId: 9, awayTeamId: 768, homeScore: 2, awayScore: 1,
  homeTeam: { id: 9, slug: "spain-9", name: "Spain" }, awayTeam: { id: 768, slug: "italy-768", name: "Italy" },
  competition: { id: 5, slug: "nations-league", name: "UEFA Nations League" }, ...over,
});
const ev = (over: Partial<MatchEvent>): MatchEvent => ({ id: "x", matchId: 1, minute: 10, type: "goal", teamId: 9, ...over }) as MatchEvent;

describe("matchday email", () => {
  it("groups scorers per side, with penalties, stoppage time and own goals credited to the other side", () => {
    const s = scorersByTeam(m(), [
      ev({ playerName: "Merino", minute: 23 }),
      ev({ playerName: "Merino", minute: 90, extraMinute: 2, type: "penalty" }),
      ev({ playerName: "Laporte", minute: 55, type: "own_goal", teamId: 9 }),
    ]);
    expect(s.home).toEqual(["Merino 23', 90+2' (P)"]);
    expect(s.away).toEqual(["Laporte 55' (OG)"]);
  });

  it("result email: score in the subject, how it was decided, vote + share-card links, unsubscribe", () => {
    const e = resultEmail("Spain", m({ resultType: "aet" }), [], "https://x/unsub");
    expect(e.subject).toBe("FT: Spain 2–1 Italy");
    expect(e.html).toContain("After extra time");
    expect(e.text).toContain("/match/spain-italy-1/card/story");
    expect(e.text).toContain("Vote Player of the Match");
    expect(e.text).toContain("https://x/unsub");
  });

  it("pre-match email lists both XIs once published, or says they're not out yet", () => {
    const lu = (teamId: number, names: string[]): Lineup => ({ matchId: 1, teamId, formation: "4-3-3", starters: names.map((name, i) => ({ playerId: i + 1, name })), bench: [] }) as Lineup;
    const withXi = preMatchEmail("Spain", m({ status: "scheduled" }), [lu(9, ["Simón", "Rodri"]), lu(768, ["Donnarumma"])], "u");
    expect(withXi.subject).toBe("Spain v Italy: line-ups are in");
    expect(withXi.text).toContain("Spain (4-3-3): Simón, Rodri");
    const noXi = preMatchEmail("Spain", m({ status: "scheduled" }), [], "u");
    expect(noXi.text).toContain("aren't out yet");
  });

  it("escapes names in HTML", () => {
    const e = resultEmail("X", m({ homeTeam: { id: 9, slug: "x", name: "<b>Evil</b>" } }), [], "u");
    expect(e.html).not.toContain("<b>Evil</b>");
  });
});

describe("accounts and votes", () => {
  it("normalizes and validates email addresses", () => {
    expect(normalizeEmail("  Fan@Example.COM ")).toBe("fan@example.com");
    expect(normalizeEmail("nope")).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
  });
  it("opens Player of the Match voting at full time, for 7 days", () => {
    const now = Date.parse("2026-10-12T00:00:00Z");
    expect(voteOpen(m(), now)).toBe(true);
    expect(voteOpen(m({ status: "live" }), now)).toBe(false);
    expect(voteOpen(m(), Date.parse("2026-10-20T00:00:00Z"))).toBe(false);
  });
});
