import { describe, it, expect } from "vitest";
import { goalMessage, isImportant, newsScore, resultCaption, todayMessage } from "@/lib/telegram/curation";
import type { Article, Match, MatchEvent } from "@/lib/providers/types";

const m = (over: Partial<Match> = {}): Match => ({
  id: 7, slug: "arsenal-chelsea-7", competitionId: 39, seasonYear: 2026, round: "Regular Season - 8",
  kickoffUtc: "2026-10-17T14:00:00Z", status: "finished", homeTeamId: 42, awayTeamId: 49, homeScore: 2, awayScore: 1,
  homeTeam: { id: 42, slug: "arsenal-42", name: "Arsenal" }, awayTeam: { id: 49, slug: "chelsea-49", name: "Chelsea" },
  competition: { id: 39, slug: "premier-league", name: "Premier League" }, ...over,
});

describe("telegram curation", () => {
  it("big clubs and nations are important; small clubs aren't; European knockouts are", () => {
    expect(isImportant(m())).toBe(true);
    expect(isImportant(m({ homeTeamId: 1, awayTeamId: 2 }))).toBe(true); // Belgium v France
    expect(isImportant(m({ homeTeamId: 1346, awayTeamId: 65 }))).toBe(false); // Coventry v Forest
    expect(isImportant(m({ homeTeamId: 1000, awayTeamId: 1001, competitionId: 2, round: "Quarter-finals" }))).toBe(true);
    expect(isImportant(m({ homeTeamId: 1000, awayTeamId: 1001, competitionId: 2, round: "League Stage - 3" }))).toBe(false);
  });

  it("result caption: score, scorers with their team, links with utm tags", () => {
    const ev = [{ id: "a", matchId: 7, minute: 23, type: "goal", teamId: 42, playerName: "Saka" }] as MatchEvent[];
    const c = resultCaption(m(), ev);
    expect(c).toContain("<b>FT: Arsenal 2–1 Chelsea</b>");
    expect(c).toContain("⚽ Saka 23' <i>(Arsenal)</i>");
    expect(c).toContain("utm_source=telegram");
  });

  it("goal message names the scorer and minute", () => {
    const g = goalMessage(m({ status: "live", minute: 23 }), { id: "a", matchId: 7, minute: 23, type: "penalty", teamId: 42, playerName: "Saka" } as MatchEvent);
    expect(g).toContain("GOAL!</b> Saka 23' (P)");
  });

  it("escapes HTML in team names", () => {
    expect(todayMessage([m({ status: "scheduled", homeTeam: { id: 42, slug: "x", name: "<script>" } })])).not.toContain("<script>");
  });

  it("only fresh, tagged news scores; big-club stories rank higher", () => {
    const now = Date.parse("2026-10-13T20:00:00Z");
    const a = (title: string, hoursAgo: number, tags = ["premier-league"]) =>
      ({ title, publishedAtUtc: new Date(now - hoursAgo * 3600_000).toISOString(), competitionTags: tags }) as Article;
    expect(newsScore(a("Arsenal agree deal", 1), now)).toBeGreaterThan(newsScore(a("Brentford update", 1), now));
    expect(newsScore(a("Arsenal agree deal", 6), now)).toBe(0);
    expect(newsScore(a("Untagged", 1, []), now)).toBe(0);
  });
});

describe("same story, different outlet", async () => {
  const { sameStory, storyWords } = await import("@/lib/telegram/curation");
  it("catches the BBC/Sky pair from 13 Oct", () => {
    expect(sameStory(storyWords("PSG boss Enrique hopes Man City are not stripped of titles"), storyWords("psg-s-luis-enrique-hopes-man-city-avoid-sanctions"))).toBe(true);
  });
  it("keeps genuinely different stories", () => {
    expect(sameStory(storyWords("Arsenal agree deal for winger"), storyWords("Chelsea sack manager after defeat"))).toBe(false);
  });
});

describe("highlight post", async () => {
  const { highlightMessage } = await import("@/lib/telegram/curation");
  it("captions the official video with score, scorers and a match link", () => {
    const ev = [{ id: "a", matchId: 7, minute: 23, type: "goal", teamId: 42, playerName: "Saka" }] as MatchEvent[];
    const t = highlightMessage(m(), "https://www.youtube.com/watch?v=abc", ev);
    expect(t).toContain("Highlights: Arsenal 2–1 Chelsea");
    expect(t).toContain("⚽ Saka 23'");
    expect(t).toContain('href="https://www.youtube.com/watch?v=abc"');
  });
});
