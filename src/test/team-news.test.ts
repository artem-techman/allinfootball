import { describe, it, expect } from "vitest";
import { articlesForTeam, matchTeamNews, teamNeedles } from "@/lib/news/teamNews";
import { absenceReason, absenceText, previewText } from "@/lib/seo/matchCopy";
import { mapInjury, playerDisplayName } from "@/lib/providers/apiFootball";
import type { Article, Injury, Match } from "@/lib/providers/types";

const NOW = Date.parse("2026-10-15T12:00:00Z");
const art = (title: string, hoursAgo = 2, dek = ""): Article => ({
  id: title, slug: title, title, dek, publishedAtUtc: new Date(NOW - hoursAgo * 3600_000).toISOString(),
  sourceName: "BBC Sport", sourceUrl: "https://x", competitionTags: [], teamTags: [], playerTags: [],
});

describe("team news headlines", () => {
  it("matches official names, bare names and nicknames", () => {
    expect(teamNeedles("Paris Saint Germain")).toEqual(expect.arrayContaining(["paris saint germain", "psg"]));
    expect(teamNeedles("Bayern München")).toEqual(expect.arrayContaining(["bayern munchen", "bayern"]));
    expect(teamNeedles("AC Milan")).toContain("milan");
    expect(teamNeedles("Manchester United")).toContain("man utd");
  });
  it("finds the story that matters before a big game", () => {
    const news = [art("Vinicius banned for El Clasico after Real Madrid red card"), art("Arsenal win again")];
    expect(articlesForTeam(news, "Real Madrid", { now: NOW }).map((a) => a.title)).toEqual([
      "Vinicius banned for El Clasico after Real Madrid red card",
    ]);
  });
  it("doesn't confuse clubs that share a word", () => {
    expect(articlesForTeam([art("Messi stars as Inter Miami win")], "Inter", { now: NOW })).toEqual([]);
    expect(articlesForTeam([art("Inter Milan sign striker")], "AC Milan", { now: NOW })).toEqual([]);
    expect(articlesForTeam([art("Chelsea appoint new sporting director")], "Sporting CP", { now: NOW })).toEqual([]);
    expect(articlesForTeam([art("Inter Milan sign striker")], "Inter", { now: NOW })).toHaveLength(1);
  });
  it("skips stale stories, caps the list, and shows a two-club story once", () => {
    expect(articlesForTeam([art("Barcelona news", 24 * 6)], "Barcelona", { now: NOW })).toEqual([]);
    const many = Array.from({ length: 6 }, (_, i) => art(`Barcelona story ${i}`, i));
    expect(articlesForTeam(many, "Barcelona", { now: NOW })).toHaveLength(3);
    const both = matchTeamNews([art("Real Madrid v Barcelona: Clasico preview"), art("Barca injury blow")], "Real Madrid", "Barcelona", { now: NOW });
    expect(both.home.map((a) => a.title)).toEqual(["Real Madrid v Barcelona: Clasico preview"]);
    expect(both.away.map((a) => a.title)).toEqual(["Barca injury blow"]);
  });
});

describe("injuries", () => {
  it("maps the provider record", () => {
    expect(
      mapInjury({ player: { id: 7, name: "Vin&iacute;cius J&uacute;nior".replace(/&iacute;/, "í").replace(/&uacute;/, "ú"), type: "Missing Fixture", reason: "Red Card" }, team: { id: 541 }, fixture: { id: 1 } }),
    ).toMatchObject({ playerId: 7, name: "Vinícius Júnior", teamId: 541, status: "out", reason: "Red Card" });
    expect(mapInjury({ player: { id: 8, name: "Rodrygo", type: "Questionable", reason: "Knock" }, team: { id: 541 } })?.status).toBe("doubt");
    expect(mapInjury({ player: { name: "No id" }, team: { id: 1 } })).toBeUndefined();
  });
  it("reads like a sentence", () => {
    expect(absenceReason("Red Card")).toBe("red card suspension");
    expect(absenceReason("Yellow Cards")).toBe("yellow card suspension");
    expect(absenceReason("Knee Injury")).toBe("knee injury");
    const rows: Injury[] = [
      { playerId: 1, name: "Vinícius Júnior", teamId: 541, status: "out", reason: "Red Card" },
      { playerId: 2, name: "Carvajal", teamId: 541, status: "out", reason: "Knee Injury" },
      { playerId: 3, name: "Rodrygo", teamId: 541, status: "doubt", reason: "Knock" },
    ];
    expect(absenceText("Real Madrid", rows)).toBe(
      "Real Madrid are without Vinícius Júnior (red card suspension) and Carvajal (knee injury); Rodrygo is a doubt.",
    );
    expect(absenceText("Barcelona", [{ playerId: 4, name: "Pedri", teamId: 529, status: "doubt" }])).toBe("Pedri is a doubt for Barcelona.");
    expect(absenceText("Barcelona", [])).toBe("");
  });
  it("adds team news to the preview only when the provider reported it", () => {
    const match: Match = {
      id: 1, slug: "real-madrid-barcelona-1", competitionId: 140, seasonYear: 2026, round: "Regular Season - 10",
      kickoffUtc: "2026-10-26T15:15:00Z", status: "scheduled", homeTeamId: 541, awayTeamId: 529,
      homeTeam: { id: 541, slug: "real-madrid-541", name: "Real Madrid" }, awayTeam: { id: 529, slug: "barcelona-529", name: "Barcelona" },
      competition: { id: 140, slug: "la-liga", name: "La Liga" },
    };
    const base = { match, homeForm: [], awayForm: [], h2h: [], table: [] };
    expect(previewText(base).join(" ")).not.toContain("injuries");
    expect(previewText({ ...base, absences: [] }).join(" ")).toContain("Neither side has reported any injuries or suspensions.");
    expect(previewText({ ...base, absences: [{ playerId: 1, name: "Vinícius Júnior", teamId: 541, status: "out", reason: "Red Card" }] }).join(" ")).toContain(
      "Real Madrid are without Vinícius Júnior (red card suspension).",
    );
  });
});

describe("player names as fans search them", () => {
  it("expands the provider's initials", () => {
    expect(playerDisplayName("B. Saka", "Bukayo Ayoyinka Temidayo")).toBe("Bukayo Saka");
    expect(playerDisplayName("E. Haaland", "Erling Braut")).toBe("Erling Haaland");
    expect(playerDisplayName("É. Mitchell", "Éderson")).toBe("Éderson Mitchell");
  });
  it("leaves full or mismatched names alone", () => {
    expect(playerDisplayName("Vinícius Júnior", "Vinícius")).toBe("Vinícius Júnior");
    expect(playerDisplayName("Bruno Fernandes", "Bruno Miguel")).toBe("Bruno Fernandes");
    expect(playerDisplayName("J. Smith", "Bob")).toBe("J. Smith");
    expect(playerDisplayName("J. Smith", undefined)).toBe("J. Smith");
  });
});
