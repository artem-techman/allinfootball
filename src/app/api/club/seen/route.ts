import { NextResponse } from "next/server";
import { currentUser, sameOrigin } from "@/lib/auth";
import { clubFromCookie } from "@/lib/club";
import { recordClubPick } from "@/lib/club/picks";

/**
 * POST /api/club/seen — a browser that chose its club before we kept records
 * reports it once, so club_picks counts every fan, not just new ones.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const club = await clubFromCookie();
  if (!club) return NextResponse.json({ ok: true, club: null });
  const user = await currentUser();
  await recordClubPick("existing", club, user?.id ?? null);
  return NextResponse.json({ ok: true, club: club.id });
}
