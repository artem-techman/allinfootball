import "server-only";

/**
 * IndexNow: tells Bing (and through it ChatGPT search, Copilot, DuckDuckGo,
 * Yandex, Seznam…) the moment a page changes, instead of waiting for a crawl.
 * The key is public by design — it's served at /{KEY}.txt to prove we own the
 * host. Costs no football-API quota.
 */

export const INDEXNOW_KEY = "f107be1629835fea0f999837d5c39ed7";
const HOST = "myfootballtracker.com";
const ENDPOINT = "https://api.indexnow.org/indexnow";
const MAX_PER_POST = 10_000;

/** Last submission's outcome per batch ("200", "422: …"), for the warm job's report. */
export const lastIndexNowStatus: string[] = [];

/** Submit URLs; returns how many were accepted (0 on any failure — next run retries). */
export async function submitToIndexNow(urls: string[]): Promise<number> {
  lastIndexNowStatus.length = 0;
  const unique = [...new Set(urls)].filter((u) => u.startsWith(`https://${HOST}/`));
  let accepted = 0;
  for (let i = 0; i < unique.length; i += MAX_PER_POST) {
    const urlList = unique.slice(i, i + MAX_PER_POST);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ host: HOST, key: INDEXNOW_KEY, keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`, urlList }),
        cache: "no-store",
      });
      // 200 = accepted, 202 = accepted pending key check.
      if (res.status === 200 || res.status === 202) accepted += urlList.length;
      else console.warn(`[indexnow] ${res.status} for ${urlList.length} urls`);
      lastIndexNowStatus.push(`${res.status}${res.ok ? "" : `: ${(await res.text().catch(() => "")).slice(0, 160)}`} (${urlList.length})`);
    } catch (err) {
      console.warn(`[indexnow] failed: ${err instanceof Error ? err.message : String(err)}`);
      lastIndexNowStatus.push(`error: ${err instanceof Error ? err.message : String(err)} (${urlList.length})`);
    }
  }
  return accepted;
}
