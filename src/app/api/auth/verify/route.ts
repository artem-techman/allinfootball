import { NextResponse } from "next/server";
import { normalizeEmail, sameOrigin, startSession, updateUser, verifyLoginCode } from "@/lib/auth";
import { clubFromCookie, resolveClub, setClubCookie } from "@/lib/club";

/**
 * POST /api/auth/verify {email, code} — check the code, sign in, and reconcile
 * the club: a club picked before signing in is saved to the account; otherwise
 * the account's saved club is restored on this device.
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
    let user = result;
    await startSession(user.id);
    const local = await clubFromCookie();
    if (local && local.id !== user.clubTeamId) {
      const club = await resolveClub(local.id);
      if (club) user = (await updateUser(user.id, { club })) ?? user;
    } else if (!local && user.clubTeamId && user.clubTeamName) {
      await setClubCookie({ id: user.clubTeamId, name: user.clubTeamName, crest: user.clubCrest ?? undefined });
    }
    return NextResponse.json({ ok: true, email: user.email });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
