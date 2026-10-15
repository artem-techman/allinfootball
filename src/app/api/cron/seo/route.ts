import { NextResponse } from "next/server";
import { warmForCrawlers } from "@/lib/seo/warm";

/** GET /api/cron/seo — keeps crawlable pages fully saved (Vercel Cron, CRON_SECRET). */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await warmForCrawlers());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
