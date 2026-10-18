import { describe, it, expect } from "vitest";
import { PEP_KINDS, SHIFT_GAP_MS, currentRoom, parseStatus, safeLink } from "@/lib/pep/model";

describe("Pep's status reports", () => {
  it("accepts a well-formed report and cleans the text", () => {
    const r = parseStatus({ kind: "posting", title: "  Posted the\nChelsea 5–1 recap  ", link: "https://www.threads.net/@myfootballtracker/post/1", monthlyVisitors: 3412 });
    expect(r).toEqual({
      ok: true,
      activity: { kind: "posting", title: "Posted the Chelsea 5–1 recap", detail: undefined, link: "https://www.threads.net/@myfootballtracker/post/1" },
      monthlyVisitors: 3412,
    });
  });
  it("rejects unknown kinds, empty titles, bad links and silly numbers", () => {
    expect(parseStatus({ kind: "hacking", title: "x".repeat(10) }).ok).toBe(false);
    expect(parseStatus({ kind: "posting", title: "  " }).ok).toBe(false);
    expect(parseStatus({ kind: "posting", title: "Hello there", link: "https://evil.example/phish" }).ok).toBe(false);
    expect(parseStatus({ kind: "posting", title: "Hello there", link: "javascript:alert(1)" }).ok).toBe(false);
    expect(parseStatus({ kind: "analysing", title: "Numbers", monthlyVisitors: -5 }).ok).toBe(false);
    expect(parseStatus(null).ok).toBe(false);
  });
  it("only links to our site and known platforms, over https", () => {
    expect(safeLink("https://myfootballtracker.com/match/x-1")).toBeTruthy();
    expect(safeLink("https://bsky.app/profile/x")).toBeTruthy();
    expect(safeLink("http://myfootballtracker.com/")).toBeUndefined();
    expect(safeLink("https://myfootballtracker.com.evil.io/")).toBeUndefined();
  });
  it("caps long text", () => {
    const r = parseStatus({ kind: "writing", title: "t".repeat(400), detail: "d".repeat(900) });
    expect(r.ok && r.activity.title.length).toBe(140);
    expect(r.ok && r.activity.detail?.length).toBe(500);
  });
});

describe("where Pep is standing", () => {
  const now = Date.parse("2026-10-18T12:00:00Z");
  const act = (kind: keyof typeof PEP_KINDS, minsAgo: number) => ({
    current: { id: 1, kind, title: "x", at: new Date(now - minsAgo * 60_000).toISOString() },
  });
  it("goes to the room for his latest task while he's on shift", () => {
    expect(currentRoom(act("posting", 5), now)).toEqual({ room: "studio", onShift: true });
    expect(currentRoom(act("outreach", 30), now)).toEqual({ room: "press", onShift: true });
    expect(currentRoom(act("watching", 1), now)).toEqual({ room: "match", onShift: true });
  });
  it("recharges at the dock between shifts or before his first report", () => {
    expect(currentRoom(act("posting", SHIFT_GAP_MS / 60_000 + 1), now)).toEqual({ room: "lobby", onShift: false });
    expect(currentRoom(act("resting", 1), now)).toEqual({ room: "lobby", onShift: false });
    expect(currentRoom({ current: null }, now)).toEqual({ room: "lobby", onShift: false });
  });
});

describe("Pep's walk around the office", () => {
  it("can walk from every room to every other room, through the doors", async () => {
    const { findPath, ROOMS } = await import("@/components/pep/OfficeMap");
    const spots = Object.values(ROOMS).map((r) => r.spot);
    for (const a of spots) for (const b of spots) {
      const path = findPath(a, b);
      expect(path[0]).toBe(a);
      expect(path.at(-1)).toBe(b);
      if (a !== b) expect(path.length).toBeGreaterThan(2); // never a straight line through walls
    }
    expect(findPath("studio", "ceo")).toEqual(["studio", "studio_in", "studio_door", "H_studio", "H_ceo", "ceo_door", "ceo"]);
    expect(findPath("press", "work")).toEqual(["press", "press_door", "side", "work_door", "work_in", "work"]);
  });
});

describe("community chat rules", () => {
  it("cleans messages and caps their length", async () => {
    const { cleanBody } = await import("@/lib/pep/chatModel");
    expect(cleanBody("  hello   Pep ​ ")).toEqual({ ok: true, body: "hello Pep" });
    expect(cleanBody("   ").ok).toBe(false);
    expect(cleanBody("x".repeat(281)).ok).toBe(false);
    expect(cleanBody(42).ok).toBe(false);
  });
  it("chat names: sensible, and nobody can pose as Pep or staff", async () => {
    const { cleanName } = await import("@/lib/pep/chatModel");
    expect(cleanName("Gunner_92")).toEqual({ ok: true, name: "Gunner_92" });
    expect(cleanName("Zoë Müller")).toEqual({ ok: true, name: "Zoë Müller" });
    for (const bad of ["P", "Pep", "the real pep", "Admin", "MyFootballTracker", "<script>", "x".repeat(21)]) {
      expect(cleanName(bad).ok).toBe(false);
    }
  });
});
