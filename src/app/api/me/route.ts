import { NextResponse } from "next/server";
import { currentUser, sameOrigin, updateUser } from "@/lib/auth";
import { clubFromCookie, resolveClub, setClubCookie } from "@/lib/club";
import { emailEnabled } from "@/lib/email";

/**
 * GET  /api/me → { user: {email, matchdayEmail} | null, club, emailEnabled }
 * POST /api/me { clubId?: number | null, matchdayEmail?: boolean } → updates the
 *   club (cookie, and the account when signed in) and email preference.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const [user, club] = await Promise.all([currentUser(), clubFromCookie()]);
  return NextResponse.json(
    {
      user: user ? { email: user.email, matchdayEmail: user.matchdayEmail } : null,
      club,
      emailEnabled: emailEnabled(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { clubId?: unknown; matchdayEmail?: unknown };
  const user = await currentUser();

  let club = await clubFromCookie();
  if (body.clubId === null) {
    club = null;
    await setClubCookie(null);
    if (user) await updateUser(user.id, { club: null });
  } else if (typeof body.clubId === "number") {
    const resolved = await resolveClub(body.clubId);
    if (!resolved) return NextResponse.json({ error: "unknown_club" }, { status: 400 });
    club = resolved;
    await setClubCookie(resolved);
    if (user) await updateUser(user.id, { club: resolved });
  }
  if (typeof body.matchdayEmail === "boolean") {
    if (!user) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });
    await updateUser(user.id, { matchdayEmail: body.matchdayEmail });
  }
  return NextResponse.json({ ok: true, club });
}
