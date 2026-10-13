import { NextResponse } from "next/server";
import { runTelegram } from "@/lib/telegram/run";
import { postText, telegramEnabled } from "@/lib/telegram";

/**
 * GET /api/cron/telegram — the channel bot (Vercel Cron, CRON_SECRET).
 * `?test=1` posts a one-off hello to confirm the bot can write to the channel.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!telegramEnabled()) return NextResponse.json({ skipped: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL not set" });
  if (new URL(request.url).searchParams.get("test") === "1") {
    try {
      const id = await postText("👋 My Football Tracker bot is connected. Goals, results, highlights and the big stories will appear here.");
      return NextResponse.json({ ok: true, messageId: id });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
    }
  }
  try {
    return NextResponse.json(await runTelegram());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
