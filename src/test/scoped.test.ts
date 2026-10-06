import { describe, it, expect, beforeEach, vi } from "vitest";
import { cache } from "@/lib/cache";
import type { FootballProvider, Match } from "@/lib/providers/types";

// The live-detail batch is the only direct provider call scoped.ts makes; stub it.
const bundleCalls: number[][] = [];
const bundleTtls: number[] = [];
const finishedIds = new Set<number>();
vi.mock("@/lib/providers/apiFootball", async (orig) => {
  const real = await orig<typeof import("@/lib/providers/apiFootball")>();
  return {
    ...real,
    getFixtureBundles: vi.fn(async (ids: number[], ttl = 45) => {
      bundleCalls.push(ids);
      bundleTtls.push(ttl);
      return new Map(
        ids.map((id) => [
          id,
          { match: { ...fx(id, finishedIds.has(id) ? "finished" : "live", 0), minute: 67 }, events: [], lineups: [], stats: [] },
        ]),
      );
    }),
  };
});

const { guardProvider, normalizeName } = await import("@/lib/providers/scoped");

const HOUR = 3_600_000;
function fx(id: number, status: Match["status"], offsetMs: number, home = 100 + id, away = 200 + id, league = 39): Match {
  return {
    id,
    slug: `a-b-${id}`,
    competitionId: league,
    seasonYear: 2026,
    round: "Regular Season - 7",
    kickoffUtc: new Date(Date.now() + offsetMs).toISOString(),
    status,
    homeTeamId: home,
    awayTeamId: away,
    homeTeam: { id: home, slug: `h-${home}`, name: home === 47 ? "Tottenham" : `Home ${home}` },
    awayTeam: { id: away, slug: `a-${away}`, name: `Away ${away}` },
  };
}

/** A fake upstream that counts every call, so we can assert "0 provider calls". */
function fakeInner(fixtures: Match[]) {
  const calls: string[] = [];
  const handler: ProxyHandler<object> = {
    get(_t, prop: string) {
      if (prop === "name") return "fake";
      return async (...args: unknown[]) => {
        calls.push(`${prop}(${args.join(",")})`);
        if (prop === "getFixturesByLeague") return args[0] === 39 && args[1] === 2026 ? fixtures : [];
        if (prop === "getLiveFixtures") return [];
        if (prop === "getMatch") return undefined;
        if (prop === "getTeam") return { team: { id: args[0] } };
        return [];
      };
    },
  };
  return { inner: new Proxy({}, handler) as FootballProvider, calls, upstream: () => calls.filter((c) => !c.startsWith("getFixturesByLeague")) };
}

describe("scope guard", () => {
  beforeEach(() => {
    cache.clear();
    bundleCalls.length = 0;
    bundleTtls.length = 0;
    finishedIds.clear();
  });

  it("out-of-scope fixture, team, league and season cost zero upstream calls", async () => {
    const { inner, upstream } = fakeInner([fx(1, "finished", -48 * HOUR)]);
    const p = guardProvider(inner);
    for (let id = 1_400_000; id < 1_400_200; id += 1) expect(await p.getMatch(id)).toBeUndefined();
    expect(await p.getTeam(999_999)).toBeUndefined();
    expect(await p.getStandings(71, 2025)).toEqual([]); // Brazil Série A
    expect(await p.getStandings(39, 1999)).toEqual([]);
    expect(await p.getHeadToHead(1, 2)).toEqual([]);
    expect(await p.getEvents(1_400_000)).toEqual([]);
    expect(upstream()).toEqual([]);
  });

  it("serves an in-scope finished match from the season list with no extra call", async () => {
    const { inner, upstream } = fakeInner([fx(1, "finished", -48 * HOUR)]);
    const p = guardProvider(inner);
    expect((await p.getMatch(1))?.status).toBe("finished");
    expect(upstream()).toEqual([]);
  });

  it("future fixtures outside the window have no events/lineups/stats to fetch", async () => {
    const { inner, upstream } = fakeInner([fx(2, "scheduled", 48 * HOUR)]);
    const p = guardProvider(inner);
    expect(await p.getLineups(2)).toEqual([]);
    expect(await p.getEvents(2)).toEqual([]);
    expect(upstream()).toEqual([]);
  });

  it("in-play matches share one fast batch; upcoming ones a slow batch; nothing per fixture", async () => {
    const { inner, upstream } = fakeInner([fx(3, "live", -60 * 60_000), fx(4, "scheduled", 30 * 60_000), fx(5, "scheduled", 6 * HOUR)]);
    const p = guardProvider(inner);
    expect((await p.getMatch(3))?.minute).toBe(67);
    await p.getEvents(3);
    await p.getLineups(4);
    await p.getStatistics(3);
    const fast = bundleCalls.filter((_, i) => bundleTtls[i] === 45).map((ids) => ids.join());
    const slow = bundleCalls.filter((_, i) => bundleTtls[i] === 300).map((ids) => ids.join());
    expect(new Set(fast)).toEqual(new Set(["3"]));
    expect(new Set(slow)).toEqual(new Set(["4"]));
    expect(upstream()).toEqual([]); // no per-fixture calls, and no live=all poll
  });

  it("stops refreshing a match once a batch shows it finished", async () => {
    const { inner } = fakeInner([fx(6, "live", -100 * 60_000)]);
    const p = guardProvider(inner);
    finishedIds.add(6);
    await p.getLiveFixtures();
    const before = bundleCalls.length;
    cache.delete("bundles:45:6"); // even with the batch expired …
    await p.getLiveFixtures();
    await p.getMatch(6);
    expect(bundleCalls.length).toBe(before); // … it isn't fetched again
    expect((await p.getMatch(6))?.status).toBe("finished");
  });

  it("doesn't poll the live feed when nothing of ours is in its window", async () => {
    const { inner, upstream } = fakeInner([fx(6, "scheduled", 10 * HOUR)]);
    const p = guardProvider(inner);
    expect(await p.getLiveFixtures()).toEqual([]);
    expect(upstream()).toEqual([]);
  });

  it("derives dates and team fixtures from the lists (no by-date call)", async () => {
    const { inner, upstream } = fakeInner([fx(7, "finished", -72 * HOUR), fx(8, "scheduled", 72 * HOUR, 107)]);
    const p = guardProvider(inner);
    const past = await p.getTeamFixtures(107, { last: 5 });
    const next = await p.getTeamFixtures(107, { next: 5 });
    expect(past.map((m) => m.id)).toEqual([7]);
    expect(next.map((m) => m.id)).toEqual([8]);
    expect(upstream()).toEqual([]);
  });

  it("searches teams locally, with nicknames", async () => {
    const { inner, upstream } = fakeInner([fx(9, "scheduled", 72 * HOUR, 47)]);
    const p = guardProvider(inner);
    expect((await p.searchTeams("spurs")).map((t) => t.name)).toEqual(["Tottenham"]);
    expect((await p.searchTeams("totten")).map((t) => t.name)).toEqual(["Tottenham"]);
    expect(upstream()).toEqual([]);
  });

  it("normalizes accents and punctuation", () => {
    expect(normalizeName("Bayern München")).toBe("bayern munchen");
    expect(normalizeName("Paris Saint-Germain")).toBe("paris saint germain");
  });
});
