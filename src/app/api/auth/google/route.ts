import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OAUTH_COOKIE, googleAuthUrl, googleEnabled, googleRedirectUri, safeNext } from "@/lib/auth/google";

/** GET /api/auth/google?next=/my-club — off to Google's account chooser. */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  if (!googleEnabled()) return NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}signin=unavailable`, request.url));
  const state = randomBytes(18).toString("base64url");
  (await cookies()).set(OAUTH_COOKIE, JSON.stringify({ state, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // sent on Google's top-level redirect back to us
    path: "/api/auth/google",
    maxAge: 10 * 60,
  });
  return NextResponse.redirect(googleAuthUrl(state, googleRedirectUri(request.url)));
}
