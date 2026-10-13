import { NextResponse } from "next/server";
import { endSession, sameOrigin } from "@/lib/auth";

/** POST /api/auth/logout — end this device's session (the club stays on the device). */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await endSession();
  return NextResponse.json({ ok: true });
}
