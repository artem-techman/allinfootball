import { describe, it, expect, beforeEach, vi } from "vitest";
import type { FootballProvider, Match } from "@/lib/providers/types";

/* ----------------------- in-memory Redis stand-in ------------------------ */
const kv = new Map<string, string>();
const hashes = new Map<string, Map<string, string>>();
const h = (k: string) => hashes.get(k) ?? hashes.set(k, new Map()).get(k)!;
let commands = 0;
function exec(args: (string | number)[]): unknown {
  commands += 1;
  const [cmd, ...a] = args.map(String);
  switch (cmd) {
    case "GET": return kv.get(a[0]) ?? null;
    case "MGET": return a.map((k) => kv.get(k) ?? null);
    case "SET": {
      if (a.includes("NX") && kv.has(a[0])) return null;
      kv.set(a[0], a[1]);
      return "OK";
    }
    case "DEL": a.forEach((k) => kv.delete(k)); return 1;
    case "HGET": return h(a[0]).get(a[1]) ?? null;
    case "HMGET": return a.slice(1).map((f) => h(a[0]).get(f) ?? null);
    case "HGETALL": return [...h(a[0])].flat();
    case "HSET": for (let i = 1; i < a.length; i += 2) h(a[0]).set(a[i], a[i + 1]); return 1;
    case "HDEL": a.slice(1).forEach((f) => h(a[0]).delete(f)); return 1;
    case "HKEYS": return [...h(a[0]).keys()];
    default: throw new Error(`unsupported ${cmd}`);
  }
}
vi.mock("@/lib/store/redis", async (orig) => {
  const real = await orig<typeof import("@/lib/store/redis")>();
  const fake = {
    cmd: async (...args: (string | number)[]) => exec(args),
    pipeline: async (cmds: (string | number)[][]) => cmds.map(exec),
  };
  return { ...real, redis: () => fake };
});

/* ----------------------------- fake provider ----------------------------- */
const HOUR = 3_600_000;
const fetched: string[] = [];
let seasonList: Match[] = [];
let bundleStatus: Match["status"] = "live";
vi.mock("@/lib/providers/apiFootball", async (orig) => {
  const real = await orig<typeof import("@/lib/providers/apiFootball")>();
  return {
    ...real,
    ingestFetch: {
      seasonFixtures: async (l: number, s: number) => (fetched.push(`list:${l}:${s}`), l === 39 ? seasonList : []),
      fixturesOnDate: async () => (fetched.push("date"), []),
      bundles: async (ids: number[]) => (
        fetched.push(`bundles:${ids.join(",")}`),
        ids.map((id) => ({ match: { ...seasonList.find((m) => m.id === id)!, status: bundleStatus, minute: 70, homeScore: 2, awayScore: 1 }, events: [], lineups: [], stats: [] }))
      ),
      standings: async () => (fetched.push("standings"), []),
      topScorers: async () => (fetched.push("scorers"), []),
      topAssists: async () => (fetched.push("assists"), []),
    },
  };
});

const { classifyWindow, shouldReplace, runIngestPass } = await import("@/lib/ingest");
const { storeProvider } = await import("@/lib/store/reader");
const { cache } = await import("@/lib/cache");
const { K } = await import("@/lib/store/keys");

function fx(id: number, status: Match["status"], offsetMs: number, extra: Partial<Match> = {}): Match {
  return {
    id, slug: `a-b-${id}`, competitionId: 39, seasonYear: 2026, round: "Regular Season - 8",
    kickoffUtc: new Date(Date.now() + offsetMs).toISOString(), status,
    homeTeamId: 100 + id, awayTeamId: 200 + id,
    homeTeam: { id: 100 + id, slug: `h-${id}`, name: `Home ${id}` }, awayTeam: { id: 200 + id, slug: `a-${id}`, name: `Away ${id}` },
    ...extra,
  };
}

describe("ingest scheduling rules", () => {
  it("splits the live window into in-play and upcoming; ignores finished and far-off fixtures", () => {
    const now = Date.now();
    const out = classifyWindow(
      [fx(1, "live", -HOUR), fx(2, "scheduled", 30 * 60_000), fx(3, "finished", -HOUR), fx(4, "scheduled", 5 * HOUR), fx(5, "scheduled", -2 * 60_000)],
      now,
    );
    expect(out.inPlay.sort()).toEqual([1, 5]); // 5: kickoff passed but still "scheduled" → poll it
    expect(out.upcoming).toEqual([2]);
  });

  it("never steps a fixture backwards, but always takes a moved kickoff", () => {
    const live = fx(1, "live", -HOUR, { minute: 70 });
    expect(shouldReplace(live, { ...live, minute: 65 })).toBe(false);
    expect(shouldReplace(live, { ...live, status: "scheduled", minute: undefined })).toBe(false);
    expect(shouldReplace(live, { ...live, minute: 72 })).toBe(true);
    expect(shouldReplace(live, { ...live, kickoffUtc: new Date(0).toISOString() })).toBe(true);
    expect(shouldReplace(null, live)).toBe(true);
  });
});

describe("worker + store end to end", () => {
  beforeEach(() => {
    kv.clear();
    hashes.clear();
    cache.clear();
    fetched.length = 0;
    commands = 0;
    bundleStatus = "live";
    seasonList = [fx(10, "live", -HOUR), fx(11, "scheduled", 3 * 24 * HOUR), fx(12, "finished", -3 * 24 * HOUR)];
  });

  it("loads season lists into per-day, per-team and per-league indexes", async () => {
    for (let i = 0; i < 8; i += 1) await runIngestPass(0); // a few passes to cover every list
    expect(JSON.parse(kv.get(K.league(39, 2026))!)).toEqual([12, 10, 11]);
    expect(JSON.parse(kv.get(K.team(110, 39, 2026))!)).toEqual([10]);
    expect(kv.get(K.fx(11))).toBeTruthy();
  });

  it("refreshes in-play matches in one batch and publishes the live list", async () => {
    for (let i = 0; i < 8; i += 1) await runIngestPass(0);
    hashes.get(K.meta)!.set("inplay", "0");
    fetched.length = 0;
    await runIngestPass(1);
    expect(fetched).toEqual(["bundles:10"]); // only the in-play fixture, nothing else on pass 1
    const live = JSON.parse(kv.get(K.live)!);
    expect(live.matches.map((m: Match) => m.id)).toEqual([10]);
  });

  it("serves pages from the store with ZERO fallback/provider calls, live overlaid", async () => {
    for (let i = 0; i < 8; i += 1) await runIngestPass(0);
    hashes.get(K.meta)!.set("inplay", "0");
    await runIngestPass(1);
    const calls: string[] = [];
    const spy = new Proxy({}, { get: (_t, p: string) => (p === "name" ? "spy" : async () => (calls.push(p), [])) }) as FootballProvider;
    const p = storeProvider(spy, spy);
    const today = (await import("@/lib/utils/date")).toDateKey(new Date(seasonList[0].kickoffUtc));
    const day = await p.getFixturesByDate(today);
    expect(day.map((m) => [m.id, m.minute, m.homeScore])).toEqual([[10, 70, 2]]);
    expect(await p.getMatch(999_999)).toBeUndefined(); // not ours → 404, no provider call
    expect((await p.searchTeams("home 1")).length).toBeGreaterThan(0);
    expect(calls).toEqual([]);
  });

  it("a finished match is kept final and retired from the live hash", async () => {
    for (let i = 0; i < 8; i += 1) await runIngestPass(0);
    bundleStatus = "finished";
    hashes.get(K.meta)!.set("inplay", "0");
    await runIngestPass(1);
    expect(JSON.parse(kv.get(K.fx(10))!).status).toBe("finished");
    expect(h(K.liveDetail).has("10")).toBe(false);
    expect(JSON.parse(kv.get(K.live)!).matches).toEqual([]);
    expect(hashes.get(K.meta)!.get("dirty:39")).toBeTruthy(); // table refresh flagged
  });

  it("falls back to the old path while the store isn't ready", async () => {
    const calls: string[] = [];
    const spy = new Proxy({}, { get: (_t, p: string) => (p === "name" ? "spy" : async () => (calls.push(p), [])) }) as FootballProvider;
    await storeProvider(spy, spy).getFixturesByDate("2026-10-10");
    expect(calls).toEqual(["getFixturesByDate"]);
  });
});
