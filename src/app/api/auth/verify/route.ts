import { NextResponse } from "next/server";
import { normalizeEmail, sameOrigin, verifyLoginCode } from "@/lib/auth";
import { completeSignIn } from "@/lib/auth/complete";

/**
 * POST /api/auth/verify {email, code} — check the code, then sign in (session,
 * club reconcile, club-pick history: see completeSignIn).
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; code?: unknown };
  const email = normalizeEmail(body.email);
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!email) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  try {
    const result = await verifyLoginCode(email, code);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    const user = await completeSignIn(result, "email");
    return NextResponse.json({ ok: true, email: user.email });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
