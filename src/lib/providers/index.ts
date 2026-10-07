import "server-only";

import { apiFootball } from "./apiFootball";
import { footballDataOrg } from "./footballDataOrg";
import { guardProvider } from "./scoped";
import { storeProvider } from "@/lib/store/reader";
import type { FootballProvider } from "./types";

/**
 * Provider selector. PROVIDER env chooses the active source; apiFootball is the
 * default. Import the singleton `provider` everywhere server-side — never import
 * a concrete adapter directly outside this module.
 */
export function getProvider(): FootballProvider {
  const name = process.env.PROVIDER ?? "apiFootball";
  switch (name) {
    case "footballDataOrg":
      return footballDataOrg;
    case "apiFootball":
    default:
      return apiFootball;
  }
}

/** Every page and route goes through the scope guard (see scoped.ts): out-of-scope
 *  ids, leagues, seasons and dates cost zero provider calls. */
const guarded = guardProvider(getProvider());

/**
 * Where pages read football data from:
 *  - "store" (DATA_SOURCE=store): the Redis store the ingest worker fills — no
 *    provider calls on a visitor's request. Falls back to `guarded` by itself
 *    whenever the store isn't ready or reachable.
 *  - otherwise: the scope-guarded provider (the pre-store path).
 */
export const guardedProvider: FootballProvider = guarded;
export const storeBackedProvider: FootballProvider = storeProvider(getProvider(), guarded);
export const provider: FootballProvider =
  process.env.DATA_SOURCE === "store" ? storeBackedProvider : guarded;
