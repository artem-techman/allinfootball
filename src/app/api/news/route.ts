import { NextResponse } from "next/server";
import { getNews } from "@/lib/news";

/**
 * GET /api/news?comp=<slug>&tag=transfers&limit=<n> — tagged, deduped, link-out
 * news for the nine competitions. Degrades to an empty list on failure (section 10).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const comp = searchParams.get("comp") ?? undefined;
  const transfer = searchParams.get("tag") === "transfers";
  const limit = Number(searchParams.get("limit")) || undefined;

  try {
    const articles = await getNews({ comp, transfer, limit });
    return NextResponse.json({ articles });
  } catch {
    return NextResponse.json({ articles: [], delayed: true }, { status: 200 });
  }
}
