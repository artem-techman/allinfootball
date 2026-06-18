import "server-only";

import { apiFootball } from "./apiFootball";
import { footballDataOrg } from "./footballDataOrg";
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

export const provider: FootballProvider = getProvider();
