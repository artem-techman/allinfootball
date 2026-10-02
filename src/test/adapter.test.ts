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
  mapFixtures,
  mergeLiveSources,
  fixLegacyEvents,
  decodeName,
  allowCall,
  effectiveBudget,
  isTooStale,
  pickSeasonYear,
} from "@/lib/providers/apiFootball";
import { mapStatus, isInPlay } from "@/lib/providers/statusMap";
import { seasonYearFor } from "@/lib/season";
import { isInScope, isQualifyingRound } from "@/lib/constants/competitions";

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
  });

  it("reads substitutions the right way round: provider `assist` comes ON, `player` goes OFF", () => {
    // In the recorded fixture C. Eriksen (1485) is on the bench and B. Fernandes
    // starts — so Eriksen is the one coming on. The v1 mapper showed it backwards.
    const sub = mapEvent(events[4], 1001, 4);
    expect(sub.playerId).toBe(1485);
    expect(sub.playerName).toBe("C. Eriksen");
    expect(sub.relatedPlayerName).toBe("B. Fernandes");
    // Goals are unchanged: player = scorer, assist = assister.
    const goal = mapEvent(events[0], 1001, 0);
    expect(goal.playerName).toBe("B. Fernandes");
  });

  it("corrects substitutions in archived v1 rows on read, and leaves v2 rows alone", () => {
    const v1 = { id: "x", matchId: 1, minute: 58, type: "sub", teamId: 1, playerId: 10, playerName: "Torres", relatedPlayerId: 20, relatedPlayerName: "Pedri" } as const;
    const fixed = fixLegacyEvents([v1 as never], null)[0];
    expect(fixed.playerName).toBe("Pedri");
    expect(fixed.relatedPlayerName).toBe("Torres");
    expect(fixLegacyEvents([v1 as never], 2)[0].playerName).toBe("Torres");
  });

  it("decodes HTML entities in names", () => {
    expect(decodeName("O&apos;runov")).toBe("O'runov");
    expect(decodeName("A &amp; B")).toBe("A & B");
    expect(decodeName(undefined)).toBeUndefined();
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

describe("competition scope (qualifying rounds)", () => {
  it("keeps competition-proper rounds in scope", () => {
    expect(isInScope(2, "League Stage - 1")).toBe(true);
    expect(isInScope(2, "Knockout Round Play-offs")).toBe(true); // real UCL main-phase round
    expect(isInScope(1, "Group Stage - 1")).toBe(true);
    expect(isInScope(39)).toBe(true); // leagues have no qualifying phase
  });

  it("excludes UCL/UEL qualifying + preliminary rounds (the July minnow leak)", () => {
    expect(isInScope(2, "1st Qualifying Round")).toBe(false);
    expect(isInScope(2, "2nd Qualifying Round")).toBe(false);
    expect(isInScope(3, "3rd Qualifying Round")).toBe(false);
    expect(isInScope(2, "Preliminary Round")).toBe(false);
    expect(isQualifyingRound("Qualifying Round 1")).toBe(true);
    expect(isQualifyingRound(undefined)).toBe(false);
    // UEFA pre-league play-offs are qualifying; the main-phase knockout play-offs are not.
    expect(isInScope(2, "Play-offs")).toBe(false);
    expect(isInScope(2, "Knockout Round Play-offs")).toBe(true);
    expect(isInScope(253, "Play-offs")).toBe(true);
  });

  it("out-of-scope league ids stay out regardless of round", () => {
    expect(isInScope(999, "Regular Season - 1")).toBe(false);
  });
});

describe("mergeLiveSources", () => {
  const mk = (id: number, status: string, competitionId = 1, round = "Final") =>
    ({ id, status, competitionId, round } as unknown as Parameters<typeof mergeLiveSources>[0][number]);
  const listed = (...ms: ReturnType<typeof mk>[]) => new Map(ms.map((m) => [m.id, m]));
  const bundles = (...ms: ReturnType<typeof mk>[]) => new Map(ms.map((m) => [m.id, { match: m }]));
  const ids = (ms: { id: number }[]) => ms.map((m) => m.id).sort();

  it("the fresh by-id bundle decides: an ended match never comes back (Kazakhstan v Moldova)", () => {
    expect(mergeLiveSources([mk(1, "live")], listed(mk(1, "live")), bundles(mk(1, "finished")))).toEqual([]);
  });

  it("a live=all straggler is dropped once our fixture list says it's over (World Cup final at 104')", () => {
    expect(mergeLiveSources([mk(2, "live")], listed(mk(2, "finished")), new Map())).toEqual([]);
  });

  it("a just-kicked-off match shows even while the list still says scheduled", () => {
    expect(ids(mergeLiveSources([mk(3, "live")], listed(mk(3, "scheduled")), new Map()))).toEqual([3]);
    expect(ids(mergeLiveSources([], listed(mk(4, "scheduled")), bundles(mk(4, "live"))))).toEqual([4]);
  });

  it("includes half-time, and live=all matches we have no other record of", () => {
    expect(ids(mergeLiveSources([mk(5, "live")], new Map(), bundles(mk(6, "ht"))))).toEqual([5, 6]);
  });

  it("drops postponed/cancelled matches live=all may still list", () => {
    expect(mergeLiveSources([mk(7, "live"), mk(8, "live")], listed(mk(7, "postponed"), mk(8, "cancelled")), new Map())).toEqual([]);
  });
});

describe("quota tiers (allowCall)", () => {
  const at = (used: number, limit: number | null = 7500) => ({ used, limit });
  it("sheds extras first, then detail, then core; live runs to the budget", () => {
    expect(allowCall("extra", at(4000), NaN)).toBe(true);
    expect(allowCall("extra", at(5000), NaN)).toBe(false); // 71%
    expect(allowCall("detail", at(5000), NaN)).toBe(true);
    expect(allowCall("detail", at(6000), NaN)).toBe(false); // 86%
    expect(allowCall("core", at(6000), NaN)).toBe(true);
    expect(allowCall("core", at(6700), NaN)).toBe(false); // 96%
    expect(allowCall("live", at(6900), NaN)).toBe(true);
    expect(allowCall("live", at(7000), NaN)).toBe(false);
  });
  it("fails CLOSED for low priorities when usage can't be read", () => {
    expect(allowCall("extra", null, NaN)).toBe(false);
    expect(allowCall("detail", null, NaN)).toBe(false);
    expect(allowCall("core", null, NaN)).toBe(true);
    expect(allowCall("live", null, NaN)).toBe(true);
  });
  it("shrinks the budget with the plan's real limit (Free plan = 100/day)", () => {
    expect(effectiveBudget(100)).toBe(93);
    expect(effectiveBudget(7500)).toBe(6975);
    expect(effectiveBudget(null)).toBe(7000);
    expect(allowCall("core", at(90, 100), NaN)).toBe(false);
  });
  it("honours a forced brownout drill", () => {
    expect(allowCall("detail", at(0), 0.9)).toBe(false);
    expect(allowCall("core", at(0), 0.9)).toBe(true);
  });
});

describe("mapFixtures resilience (2026-09-12 whole-day-wipe bug)", () => {
  it("skips unmappable records instead of throwing away the whole batch", () => {
    const good1 = fx[0];
    const good2 = fx[1];
    const broken = [
      {} as unknown as (typeof fx)[number], // no fixture/league/teams
      { fixture: { id: 9, status: {} }, league: null } as unknown as (typeof fx)[number], // null league
      { fixture: { id: 10, status: { short: "NS" } }, league: { id: 39, season: 2026 }, teams: null } as unknown as (typeof fx)[number], // null teams
    ];
    const out = mapFixtures([good1, ...broken, good2]);
    // Both good fixtures survive; the three broken records are dropped, no throw.
    expect(out).toHaveLength(2);
    expect(out.map((m) => m.id)).toEqual([fx[0].fixture.id, fx[1].fixture.id]);
  });

  it("returns [] (not a throw) when every record is broken", () => {
    expect(mapFixtures([{} as unknown as (typeof fx)[number]])).toEqual([]);
  });
});

describe("pickSeasonYear (never show last season)", () => {
  const seasons = [
    { year: 2025, current: true, start: "2025-08-15", end: "2026-05-24" },
    { year: 2026, current: false, start: "2026-08-21", end: "2027-05-30" },
  ];
  it("picks the season whose date range contains today, even if the current flag is stale", () => {
    // the exact PL bug: API left current:true on the finished 2025 season
    expect(pickSeasonYear(seasons, 2025, "2026-10-01")).toBe(2026);
  });
  it("still works mid-2025/26 season", () => {
    expect(pickSeasonYear(seasons, 2025, "2026-02-01")).toBe(2025);
  });
  it("falls back to the current flag in the off-season gap", () => {
    expect(pickSeasonYear(seasons, 2025, "2026-07-01")).toBe(2025);
  });
  it("falls back to the newest year when no flag and no dates match", () => {
    expect(pickSeasonYear([{ year: 2024, current: false }, { year: 2026, current: false }], 2024, "2026-07-01")).toBe(2026);
  });
  it("uses the fallback when there are no seasons", () => {
    expect(pickSeasonYear([], 2026, "2026-10-01")).toBe(2026);
  });
});

describe("seasonYearFor (date-driven current season)", () => {
  const PL = { slug: "premier-league", leagueId: 39, name: "PL", country: "England", type: "league", defaultSeason: 2025, verified: true } as const;
  const MLS = { slug: "mls", leagueId: 253, name: "MLS", country: "USA", type: "league", defaultSeason: 2026, verified: true } as const;
  const WC = { slug: "world-cup", leagueId: 1, name: "WC", country: "FIFA", type: "international", defaultSeason: 2026, verified: true } as const;
  const NL = { slug: "nations-league", leagueId: 5, name: "NL", country: "UEFA", type: "international", defaultSeason: 2026, verified: true } as const;

  it("European leagues: Aug–Dec use the current year (2026/27 = 2026)", () => {
    expect(seasonYearFor(PL, new Date("2026-10-02T00:00:00Z"))).toBe(2026);
    expect(seasonYearFor(PL, new Date("2026-08-01T00:00:00Z"))).toBe(2026);
  });
  it("European leagues: Jan–July use the previous year (still 2025/26)", () => {
    expect(seasonYearFor(PL, new Date("2026-02-15T00:00:00Z"))).toBe(2025);
    expect(seasonYearFor(PL, new Date("2026-05-24T00:00:00Z"))).toBe(2025);
  });
  it("Nations League is split-year like the European leagues", () => {
    expect(seasonYearFor(NL, new Date("2026-10-02T00:00:00Z"))).toBe(2026);
  });
  it("calendar-year competitions use the calendar year", () => {
    expect(seasonYearFor(MLS, new Date("2026-02-15T00:00:00Z"))).toBe(2026);
    expect(seasonYearFor(WC, new Date("2026-02-15T00:00:00Z"))).toBe(2026);
  });
  it("the World Cup keeps its latest edition between tournaments (no blank hub on 2027-01-01)", () => {
    expect(seasonYearFor(WC, new Date("2027-01-01T00:00:00Z"))).toBe(2026);
    expect(seasonYearFor(WC, new Date("2029-12-31T00:00:00Z"))).toBe(2026);
    expect(seasonYearFor(WC, new Date("2030-06-01T00:00:00Z"))).toBe(2030);
  });
  it("the Nations League only starts new editions in even years", () => {
    expect(seasonYearFor(NL, new Date("2027-03-20T00:00:00Z"))).toBe(2026);
    expect(seasonYearFor(NL, new Date("2027-09-01T00:00:00Z"))).toBe(2026);
    expect(seasonYearFor(NL, new Date("2028-09-01T00:00:00Z"))).toBe(2028);
  });
});

describe("isTooStale (Next data-cache stale-while-revalidate guard)", () => {
  const now = Date.parse("2026-10-02T16:00:00Z");
  it("accepts a body within its TTL plus grace", () => {
    expect(isTooStale(new Date(now - 35_000).toUTCString(), 30, now)).toBe(false);
  });
  it("rejects a body older than TTL plus grace (the pre-kickoff record served after kickoff)", () => {
    expect(isTooStale(new Date(now - 3 * 3600_000).toUTCString(), 30, now)).toBe(true);
  });
  it("treats a missing or garbled Date header as fresh (never a refetch storm)", () => {
    expect(isTooStale(null, 30, now)).toBe(false);
    expect(isTooStale("not a date", 30, now)).toBe(false);
  });
});
