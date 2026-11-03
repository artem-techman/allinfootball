import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { upsertGoogleUser } from "@/lib/auth";
import { completeSignIn } from "@/lib/auth/complete";
import { OAUTH_COOKIE, googleProfile, googleRedirectUri, safeNext } from "@/lib/auth/google";

/** GET /api/auth/google/callback — Google sends the fan back here with a code. */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  let saved: { state?: string; next?: string } = {};
  try {
    saved = JSON.parse(jar.get(OAUTH_COOKIE)?.value ?? "{}");
  } catch {
    /* treated as a missing state below */
  }
  jar.delete({ name: OAUTH_COOKIE, path: "/api/auth/google" });
  const next = safeNext(saved.next);
  const fail = (reason: string) => NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}signin=${reason}`, url));

  const code = url.searchParams.get("code");
  if (url.searchParams.get("error")) return fail("cancelled");
  if (!code || !saved.state || url.searchParams.get("state") !== saved.state) return fail("expired");
  try {
    const profile = await googleProfile(code, googleRedirectUri(request.url));
    if (!profile) return fail("failed");
    await completeSignIn(await upsertGoogleUser(profile), "google");
    return NextResponse.redirect(new URL(next, url));
  } catch {
    return fail("failed");
  }
}
