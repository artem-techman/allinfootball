import { describe, it, expect } from "vitest";
import { impliedSplit } from "@/components/match/impliedOdds";

describe("impliedSplit (B16)", () => {
  it("removes the margin and sums to exactly 100", () => {
    const s = impliedSplit([{ name: "x", home: 1.49, draw: 4.2, away: 7.5 }])!;
    expect(s.home + s.draw + s.away).toBe(100);
    expect(s.home).toBeGreaterThan(s.draw);
    expect(s.draw).toBeGreaterThan(s.away);
  });

  it("takes the median across price lists so one outlier can't swing it", () => {
    const fair = { home: 2.0, draw: 4.0, away: 4.0 }; // 50 / 25 / 25
    const s = impliedSplit([
      { name: "a", ...fair },
      { name: "b", ...fair },
      { name: "c", home: 10, draw: 1.5, away: 10 },
    ])!;
    expect(s).toEqual({ home: 50, draw: 25, away: 25 });
  });

  it("skips incomplete or nonsensical lists, null when nothing is usable", () => {
    expect(impliedSplit([])).toBeNull();
    expect(impliedSplit([{ name: "a", home: 2, draw: 3 }])).toBeNull();
    expect(impliedSplit([{ name: "a", home: 1, draw: 3, away: 3 }])).toBeNull();
  });

  it("rounds three equal thirds to 100, not 99", () => {
    const s = impliedSplit([{ name: "a", home: 3, draw: 3, away: 3 }])!;
    expect(s.home + s.draw + s.away).toBe(100);
  });
});
