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

describe("swr background refresh", () => {
  it("serves a recently-expired slow key instantly and refreshes behind it", async () => {
    vi.useFakeTimers();
    try {
      await swr("bg:news", 300, async () => "v1");
      vi.advanceTimersByTime(301_000); // expired 1s ago
      let calls = 0;
      const got = await swr("bg:news", 300, async () => {
        calls += 1;
        return "v2";
      });
      expect(got).toBe("v1"); // no waiting
      await vi.runAllTimersAsync();
      expect(calls).toBe(1);
      expect(await swr("bg:news", 300, async () => "v3")).toBe("v2");
    } finally {
      vi.useRealTimers();
    }
  });

  it("never serves an expired LIVE key — waits for fresh", async () => {
    vi.useFakeTimers();
    try {
      await swr("bg:live", 30, async () => "old-score");
      vi.advanceTimersByTime(31_000);
      expect(await swr("bg:live", 30, async () => "new-score")).toBe("new-score");
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits for fresh when a slow key has been stale longer than its TTL", async () => {
    vi.useFakeTimers();
    try {
      await swr("bg:table", 300, async () => "old");
      vi.advanceTimersByTime(700_000);
      expect(await swr("bg:table", 300, async () => "new")).toBe("new");
    } finally {
      vi.useRealTimers();
    }
  });
});
