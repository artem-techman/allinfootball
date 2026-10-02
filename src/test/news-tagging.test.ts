import { describe, it, expect } from "vitest";
import { hasTerm, isTransfer, tagItem } from "@/lib/news/tagging";
import { toIso } from "@/lib/news/rss";

const item = (title: string, dek = "") => ({ title, dek, link: "https://x", sourceName: "Test", publishedAtUtc: "" });

describe("news tagging is whole-word", () => {
  it("doesn't tag Serie A from 'interrupt' or Ligue 1 from 'nice'", () => {
    expect(tagItem(item("Rain interrupts training", "A nice day for the squad")).competitionTags).toEqual([]);
  });
  it("still tags real club and competition names", () => {
    expect(tagItem(item("Inter Milan beat Napoli")).competitionTags).toContain("serie-a");
    expect(tagItem(item("Spurs win at Chelsea")).competitionTags).toContain("premier-league");
    expect(tagItem(item("England top their Nations League group")).competitionTags).toContain("nations-league");
  });
  it("only flags real transfer stories", () => {
    expect(isTransfer(item("Manager: 'I feel it was a big deal for us'"))).toBe(false);
    expect(isTransfer(item("Striker signs new contract", ""))).toBe(true);
    expect(isTransfer(item("Club agree a deal for winger"))).toBe(true);
  });
  it("matches whole words only, including accents", () => {
    expect(hasTerm("bayern münchen win", "bayern")).toBe(true);
    expect(hasTerm("interview", "inter")).toBe(false);
  });
});

describe("news dates", () => {
  it("parses Sky Sports' BST dates", () => {
    expect(toIso("Fri, 02 Oct 2026 18:48:00 BST")).toBe("2026-10-02T17:48:00.000Z");
  });
  it("never invents 'now' for a missing or broken date", () => {
    expect(toIso(undefined)).toBe("");
    expect(toIso("not a date")).toBe("");
  });
});

describe("Inter vs Inter Miami", () => {
  it("doesn't tag Serie A for Inter Miami", () => {
    const tags = tagItem(item("Messi stars as Inter Miami win")).competitionTags;
    expect(tags).toContain("mls");
    expect(tags).not.toContain("serie-a");
  });
});
