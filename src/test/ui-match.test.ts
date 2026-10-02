import { describe, it, expect } from "vitest";
import { defaultTab, parseTab } from "@/components/match/matchTabs";
import { tickMinute, periodCap } from "@/components/primitives/liveClock";
import { liveMinuteLabel } from "@/lib/utils/match";
import type { Lineup, MatchStats } from "@/lib/providers/types";

const stats = [{ matchId: 1, teamId: 10, shots: 3 }] as MatchStats[];
const idOnlyStats = [{ matchId: 1, teamId: 10 }] as MatchStats[];
const lineups = [{ matchId: 1, teamId: 10, starters: [{ playerId: 1, name: "A" }], bench: [] }] as Lineup[];
const none = { stats: [] as MatchStats[], lineups: [] as Lineup[] };

describe("defaultTab (B36)", () => {
  it("opens live/HT matches on Stats when there are stats, else Summary", () => {
    expect(defaultTab("live", { stats, lineups: [] })).toBe("stats");
    expect(defaultTab("ht", { stats, lineups: [] })).toBe("stats");
    expect(defaultTab("live", none)).toBe("summary");
    expect(defaultTab("live", { stats: idOnlyStats, lineups: [] })).toBe("summary");
  });

  it("opens scheduled matches on Lineups only once they're posted, else Head-to-head", () => {
    expect(defaultTab("scheduled", { stats: [], lineups })).toBe("lineups");
    expect(defaultTab("scheduled", none)).toBe("h2h");
  });

  it("opens finished and called-off matches on Summary", () => {
    expect(defaultTab("finished", { stats, lineups })).toBe("summary");
    expect(defaultTab("postponed", none)).toBe("summary");
  });

  it("accepts only known ?tab= values", () => {
    expect(parseTab("odds")).toBe("odds");
    expect(parseTab("nope")).toBeNull();
    expect(parseTab(null)).toBeNull();
  });
});

const live = (minute?: number, extraMinute?: number) => ({ status: "live" as const, minute, extraMinute });
const label = (m: ReturnType<typeof live>, ms: number, floor?: number) => liveMinuteLabel(tickMinute(m, ms, floor));

describe("tickMinute (N7)", () => {
  it("advances one minute per 60s of real time", () => {
    expect(label(live(67), 0)).toBe("67'");
    expect(label(live(67), 59_999)).toBe("67'");
    expect(label(live(67), 60_000)).toBe("68'");
  });

  it("never runs more than 2 minutes ahead of the provider", () => {
    expect(label(live(67), 10 * 60_000)).toBe("69'");
  });

  it("stops at the end of each period until the provider moves on", () => {
    expect(label(live(44), 5 * 60_000)).toBe("45'");
    expect(label(live(89), 5 * 60_000)).toBe("90'");
    expect(label(live(104), 5 * 60_000)).toBe("105'");
    expect(label(live(119), 5 * 60_000)).toBe("120'");
    expect(periodCap(46)).toBe(90);
    expect(periodCap(121)).toBeNull();
  });

  it("does not invent stoppage time, and freezes HT / finished / no-minute readings", () => {
    expect(label(live(90, 3), 5 * 60_000)).toBe("90+3'");
    expect(label(live(undefined), 5 * 60_000)).toBe("LIVE");
    expect(tickMinute({ status: "ht", minute: 45 }, 5 * 60_000).minute).toBe(45);
    expect(tickMinute({ status: "finished", minute: 90 }, 5 * 60_000).minute).toBe(90);
  });

  it("holds the minute already on screen when a lagging reading arrives", () => {
    expect(label(live(68), 0, 69)).toBe("69'");
    // ...but the floor still can't push past provider + 2 or the period cap.
    expect(label(live(68), 0, 75)).toBe("70'");
    expect(label(live(45), 0, 47)).toBe("45'");
  });
});
