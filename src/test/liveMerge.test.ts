import { describe, it, expect } from "vitest";
import { compareProgress, liveMinuteLabel, mergeLive } from "@/lib/utils/match";
import type { Match } from "@/lib/providers/types";

const m = (id: number, status: Match["status"], minute?: number, score = [0, 0], extraMinute?: number) =>
  ({ id, status, minute, extraMinute, homeScore: score[0], awayScore: score[1] }) as unknown as Match;

describe("liveMinuteLabel", () => {
  it("shows stoppage time instead of freezing on 90'", () => {
    expect(liveMinuteLabel({ minute: 90, extraMinute: 3 })).toBe("90+3'");
    expect(liveMinuteLabel({ minute: 67 })).toBe("67'");
    expect(liveMinuteLabel({})).toBe("LIVE");
  });
});

describe("compareProgress", () => {
  it("orders scheduled < first half < HT < second half < stoppage < finished", () => {
    const seq = [m(1, "scheduled"), m(1, "live", 30), m(1, "ht"), m(1, "live", 46), m(1, "live", 90), m(1, "live", 90, [0, 0], 4), m(1, "finished")];
    for (let i = 1; i < seq.length; i += 1) expect(compareProgress(seq[i], seq[i - 1])).toBeGreaterThan(0);
  });
});

describe("mergeLive", () => {
  it("never rewinds the clock or score when an older response arrives", () => {
    const seen = new Map<number, Match>();
    const ended = new Set<number>();
    let shown = mergeLive(null, [m(1, "live", 90, [1, 1])], seen, ended);
    shown = mergeLive(shown, [m(1, "live", 78, [1, 0])], seen, ended);
    expect(shown[0].minute).toBe(90);
    expect(shown[0].awayScore).toBe(1);
  });

  it("keeps an ended match ended when a stale response echoes it as live", () => {
    const seen = new Map<number, Match>();
    const ended = new Set<number>();
    let shown = mergeLive(null, [m(1, "live", 90, [2, 1], 5)], seen, ended);
    shown = mergeLive(shown, [], seen, ended); // final whistle: it left the live list
    shown = mergeLive(shown, [m(1, "live", 90, [2, 1], 4)], seen, ended); // stale echo
    expect(shown).toEqual([]);
    shown = mergeLive(shown, [m(1, "live", 90, [2, 1], 5)], seen, ended); // same stale reading
    expect(shown).toEqual([]);
  });

  it("brings a match back only on a strictly newer reading", () => {
    const seen = new Map<number, Match>();
    const ended = new Set<number>();
    let shown = mergeLive(null, [m(1, "live", 60)], seen, ended);
    shown = mergeLive(shown, [], seen, ended);
    shown = mergeLive(shown, [m(1, "live", 61)], seen, ended);
    expect(shown.map((x) => x.minute)).toEqual([61]);
  });

  it("doesn't treat a degraded (empty) response as every match ending", () => {
    const seen = new Map<number, Match>();
    const ended = new Set<number>();
    let shown = mergeLive(null, [m(1, "live", 60)], seen, ended);
    shown = mergeLive(shown, [], seen, ended, false);
    expect(shown.map((x) => x.id)).toEqual([1]);
    shown = mergeLive(shown, [m(1, "live", 60)], seen, ended);
    expect(shown.map((x) => x.id)).toEqual([1]);
  });
});
