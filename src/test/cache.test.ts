import { describe, it, expect, vi, beforeEach } from "vitest";
import { cache, swr } from "@/lib/cache";

beforeEach(() => {
  cache.clear();
});

describe("in-memory cache", () => {
  it("stores within TTL and expires after, keeping a stale copy", () => {
    vi.useFakeTimers();
    cache.set("k1", 42, 1); // 1s TTL
    expect(cache.get<number>("k1")).toBe(42);

    vi.advanceTimersByTime(1500);
    expect(cache.get("k1")).toBeUndefined(); // expired
    const stale = cache.getStale<number>("k1");
    expect(stale?.value).toBe(42);
    expect(stale?.isStale).toBe(true);
    vi.useRealTimers();
  });
});

describe("swr (stale-while-revalidate, single-flight)", () => {
  it("returns the cached fresh value without calling the fetcher", async () => {
    cache.set("k2", "fresh", 60);
    const fetcher = vi.fn();
    expect(await swr("k2", 60, fetcher)).toBe("fresh");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("serves last-good stale data when the fetcher fails (simulated 429)", async () => {
    vi.useFakeTimers();
    cache.set("k3", "last-good", 60);
    vi.advanceTimersByTime(61_000); // entry now stale
    const value = await swr("k3", 60, async () => {
      throw new Error("API-Football failed: 429");
    });
    expect(value).toBe("last-good");
    vi.useRealTimers();
  });

  it("rethrows when the fetcher fails and there is no stale value", async () => {
    await expect(
      swr("k4-never-cached", 60, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });

  it("coalesces concurrent callers into a single fetch", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return "v";
    };
    const [a, b] = await Promise.all([swr("k5", 60, fetcher), swr("k5", 60, fetcher)]);
    expect(a).toBe("v");
    expect(b).toBe("v");
    expect(calls).toBe(1);
  });
});
