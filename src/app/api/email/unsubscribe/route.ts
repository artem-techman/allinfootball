import { NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/auth";

/** POST /api/email/unsubscribe?token= — one-click unsubscribe (RFC 8058, List-Unsubscribe-Post). */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const ok = await unsubscribeByToken(token).catch(() => false);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
