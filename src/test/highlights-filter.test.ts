import { describe, it, expect } from "vitest";
import {
  belongsToChannelCompetition,
  isCurrentContent,
  looksLikeHighlights,
  titleMatchesFixture,
} from "@/lib/highlights/youtube";

const NOW = new Date("2026-10-02T12:00:00Z");

describe("feed filtering", () => {
  it("drops full-match re-uploads and old seasons", () => {
    expect(looksLikeHighlights("FULL MATCH | Barcelona 2-0 Huesca | LaLiga 2018/19")).toBe(false);
    expect(isCurrentContent("Napoli 3-1 Lazio | Serie A 2025/26", NOW)).toBe(false);
    expect(isCurrentContent("Napoli 3-1 Lazio | Serie A 2026/27", NOW)).toBe(true);
  });
  it("drops women's, youth and other-tournament clips", () => {
    expect(looksLikeHighlights("Highlights | Women's Champions League")).toBe(false);
    expect(isCurrentContent("Vietnam 2-1 Thailand | ASEAN Cup highlights", NOW)).toBe(false);
    expect(isCurrentContent("Brazil v Japan | FIFA U-17 World Cup", NOW)).toBe(false);
  });
  it("a FIFA channel clip only counts as World Cup if it says so", () => {
    expect(belongsToChannelCompetition("Vietnam 2-1 Thailand | Highlights", "world-cup")).toBe(false);
    expect(belongsToChannelCompetition("France 2-1 Italy | FIFA World Cup 2026", "world-cup")).toBe(true);
    expect(belongsToChannelCompetition("Real Madrid 1-0 | Club World Cup", "world-cup")).toBe(false);
  });
});

describe("match highlight matcher", () => {
  const clip = (title: string, publishedAtUtc = "2026-10-01T22:00:00Z") => ({ title, publishedAtUtc });
  const q = { home: "Real Madrid", away: "Getafe", dateIso: "2026-10-01T19:00:00Z" };

  it("matches the right fixture", () => {
    expect(titleMatchesFixture(clip("HIGHLIGHTS | Real Madrid 2-1 Getafe"), q)).toBe(true);
  });
  it("doesn't confuse Atlético Madrid for Real Madrid (shared word)", () => {
    expect(titleMatchesFixture(clip("Atletico Madrid 2-1 Getafe | Highlights"), q)).toBe(false);
  });
  it("doesn't confuse Manchester City with Manchester United", () => {
    const mu = { home: "Manchester United", away: "Chelsea", dateIso: q.dateIso };
    expect(titleMatchesFixture(clip("Manchester City 3-0 Chelsea | Highlights"), mu)).toBe(false);
    expect(titleMatchesFixture(clip("Man Utd 3-0 Chelsea | Highlights"), mu)).toBe(true);
  });
  it("rejects the reverse fixture", () => {
    expect(titleMatchesFixture(clip("Getafe 1-1 Real Madrid | Highlights"), q)).toBe(false);
  });
  it("only accepts uploads between kickoff and 72h after", () => {
    expect(titleMatchesFixture(clip("Real Madrid 2-1 Getafe", "2026-09-20T22:00:00Z"), q)).toBe(false);
    expect(titleMatchesFixture(clip("Real Madrid 2-1 Getafe", "2026-10-06T22:00:00Z"), q)).toBe(false);
  });
});
