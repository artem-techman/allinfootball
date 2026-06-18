import { NextResponse } from "next/server";
import { provider } from "@/lib/providers";

/**
 * GET /api/live — live fixtures across the nine competitions. Proxies the
 * adapter (key stays server-side). On provider failure returns an empty list
 * with `delayed: true` so the Live Now rail degrades gracefully and never
 * crashes the page (CLAUDE.md section 10).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const matches = await provider.getLiveFixtures();
    return NextResponse.json({ matches });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    // Never leak the key or stack; just signal degradation.
    return NextResponse.json(
      { matches: [], delayed: true, reason: message.includes("FOOTBALL_API_KEY") ? "no_key" : "provider_error" },
      { status: 200 },
    );
  }
}
