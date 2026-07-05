import { describe, it, expect } from "vitest";
import sample from "./fixtures.sample.json";
import standingsSample from "./standings.sample.json";
import {
  mapFixture,
  mapEvent,
  mapLineup,
  mapStatistics,
  mapStandings,
  mapTopScorers,
  mapOdds,
} from "@/lib/providers/apiFootball";
import { mapStatus, isInPlay } from "@/lib/providers/statusMap";

/* eslint-disable @typescript-eslint/no-explicit-any */
const fx = sample.fixtures as any[];

describe("statusMap", () => {
  it("maps all API-Football short codes to our enum", () => {
    expect(mapStatus("NS")).toBe("scheduled");
    expect(mapStatus("TBD")).toBe("scheduled");
    expect(mapStatus("1H")).toBe("live");
    expect(mapStatus("2H")).toBe("live");
    expect(mapStatus("ET")).toBe("live");
    expect(mapStatus("P")).toBe("live");
    expect(mapStatus("LIVE")).toBe("live");
    expect(mapStatus("HT")).toBe("ht");
    expect(mapStatus("FT")).toBe("finished");
    expect(mapStatus("AET")).toBe("finished");
    expect(mapStatus("PEN")).toBe("finished");
    expect(mapStatus("PST")).toBe("postponed");
    expect(mapStatus("CANC")).toBe("cancelled");
    expect(mapStatus("ABD")).toBe("abandoned");
    expect(mapStatus("SUSP")).toBe("suspended");
    expect(mapStatus("INT")).toBe("suspended");
  });

  it("defaults unknown/empty codes to scheduled", () => {
    expect(mapStatus(undefined)).toBe("scheduled");
    expect(mapStatus("ZZZ")).toBe("scheduled");
  });

  it("only live and ht count as in-play", () => {
    expect(isInPlay("live")).toBe(true);
    expect(isInPlay("ht")).toBe(true);
    expect(isInPlay("finished")).toBe(false);
    expect(isInPlay("postponed")).toBe(false);
  });
});

describe("mapFixture", () => {
  it("maps a finished fixture with scores", () => {
    const m = mapFixture(fx[0]);
    expect(m.id).toBe(1001);
    expect(m.status).toBe("finished");
    expect(m.homeScore).toBe(2);
    expect(m.awayScore).toBe(1);
    expect(m.competitionId).toBe(39);
    expect(m.competition?.slug).toBe("premier-league");
    expect(m.slug).toContain("1001");
    expect(m.minute).toBeUndefined(); // finished -> no minute
  });

  it("surfaces a live minute only for in-play matches", () => {
    const live = mapFixture(fx[1]);
    expect(live.status).toBe("live");
    expect(live.minute).toBe(67);
  });

  it("never sets a minute for scheduled or postponed", () => {
    expect(mapFixture(fx[2]).minute).toBeUndefined(); // NS
    const pst = mapFixture(fx[3]);
    expect(pst.status).toBe("postponed");
    expect(pst.minute).toBeUndefined();
  });

  it("maps null scores to undefined, not NaN", () => {
    const ns = mapFixture(fx[2]);
    expect(ns.homeScore).toBeUndefined();
    expect(ns.awayScore).toBeUndefined();
  });

  it("captures referee and venue name", () => {
    const m = mapFixture(fx[0]);
    expect(m.refereeName).toBe("M. Oliver");
    expect(m.venueName).toBe("Old Trafford");
  });
});

describe("mapEvent names", () => {
  const events = sample.events as any[];
  it("carries player and assist names", () => {
    const goal = mapEvent(events[0], 1001, 0);
    expect(goal.playerName).toBe("B. Fernandes");
    expect(goal.relatedPlayerName).toBe("M. Rashford");
  });
});

describe("mapOdds", () => {
  it("ranks the biggest European bookmakers first and caps at five", () => {
    const o = mapOdds((sample as any).odds[0], 1001);
    // Priority order beats response order (Bet365 is listed 5th in the sample),
    // "Stake.com" is normalized to match the "stake" priority entry, and the
    // unknown local book sorts after all known ones — squeezed out by the cap.
    expect(o?.books.map((b) => b.name)).toEqual(["Bet365", "Winamax", "Stake.com", "Bwin", "Unibet"]);
  });

  it("maps 1X2 decimal prices per bookmaker", () => {
    const o = mapOdds((sample as any).odds[0], 1001);
    const bet365 = o?.books.find((b) => b.name === "Bet365");
    expect(bet365?.home).toBeCloseTo(1.8);
    expect(bet365?.draw).toBeCloseTo(3.6);
    expect(bet365?.away).toBeCloseTo(4.2);
  });

  it("drops bookmakers without a 1X2 market", () => {
    const o = mapOdds((sample as any).odds[0], 1001);
    expect(o?.books.some((b) => b.name === "NoMarketBook")).toBe(false);
  });

  it("returns undefined when no odds payload", () => {
    expect(mapOdds(undefined, 1001)).toBeUndefined();
  });
});

describe("mapEvent", () => {
  const events = sample.events as any[];
  it("maps goal/own-goal/missed-penalty/card/sub types", () => {
    expect(mapEvent(events[0], 1001, 0).type).toBe("goal");
    expect(mapEvent(events[1], 1001, 1).type).toBe("yellow");
    expect(mapEvent(events[2], 1001, 2).type).toBe("own_goal");
    expect(mapEvent(events[3], 1001, 3).type).toBe("missed_penalty");
    expect(mapEvent(events[4], 1001, 4).type).toBe("sub");
  });

  it("carries minute, extra minute and assist", () => {
    const sub = mapEvent(events[4], 1001, 4);
    expect(sub.minute).toBe(75);
    expect(sub.extraMinute).toBe(2);
    expect(sub.relatedPlayerId).toBe(1485);
  });
});

describe("mapLineup", () => {
  const lineups = sample.lineups as any[];
  it("maps formation, starters, bench, coach and grid", () => {
    const l = mapLineup(lineups[0], 1001);
    expect(l.formation).toBe("4-2-3-1");
    expect(l.coachName).toBe("E. ten Hag");
    expect(l.starters).toHaveLength(2);
    expect(l.bench).toHaveLength(1);
    expect(l.starters[1].gridRow).toBe(3);
    expect(l.starters[1].gridCol).toBe(2);
  });

  it("handles a missing formation (falls back to undefined)", () => {
    const l = mapLineup(lineups[1], 1001);
    expect(l.formation).toBeUndefined();
    expect(l.bench).toHaveLength(0);
  });
});

describe("mapStatistics", () => {
  const stats = sample.statistics as any[];
  it("parses percentages and numbers", () => {
    const s = mapStatistics(stats[0], 1001);
    expect(s.possession).toBe(55);
    expect(s.passAccuracy).toBe(83);
    expect(s.shots).toBe(14);
    expect(s.xg).toBeCloseTo(1.84);
  });

  it("maps null and absent fields to undefined (no NaN)", () => {
    const a = mapStatistics(stats[0], 1001);
    expect(a.red).toBeUndefined(); // value: null
    const b = mapStatistics(stats[1], 1001);
    expect(b.xg).toBeUndefined(); // type absent entirely
    expect(b.shotsInBox).toBeUndefined();
  });
});

describe("mapStandings", () => {
  it("flattens a single linear group", () => {
    const rows = mapStandings((standingsSample as any).linear);
    expect(rows).toHaveLength(2);
    expect(rows[0].position).toBe(1);
    expect(rows[0].points).toBe(25);
    expect(rows[0].form).toEqual(["W", "W", "D", "W", "L"]);
    expect(rows[0].groupLabel).toBe("Premier League");
  });

  it("flattens multiple World Cup groups and keeps groupLabel", () => {
    const rows = mapStandings((standingsSample as any).group);
    expect(rows).toHaveLength(4);
    const groups = new Set(rows.map((r) => r.groupLabel));
    expect(groups).toEqual(new Set(["Group A", "Group B"]));
    const germany = rows.find((r) => r.teamId === 25);
    expect(germany?.form).toEqual(["W", "W", "W"]);
  });
});

describe("mapTopScorers", () => {
  it("ranks scorers and defaults null assists to 0", () => {
    const scorers = mapTopScorers(sample.topscorers as any[], 39, 2025);
    expect(scorers[0].rank).toBe(1);
    expect(scorers[0].goals).toBe(18);
    expect(scorers[0].assists).toBe(9);
    expect(scorers[1].assists).toBe(0); // null -> 0
    expect(scorers[1].player?.slug).toContain("1100");
  });
});
