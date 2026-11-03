import "server-only";

/**
 * "Continue with Google" (OpenID Connect, authorization-code flow, no SDK).
 * Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from a Google Cloud OAuth
 * client whose redirect URI is <site>/api/auth/google/callback. The ID token is
 * received straight from Google's token endpoint over TLS with our secret, so
 * (per the OIDC spec) its claims are checked rather than its signature.
 */

/** Short-lived cookie holding the anti-forgery state and where to return. */
export const OAUTH_COOKIE = "mft_oauth";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function googleEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Our callback URL. Production always uses the canonical domain (it must match
 *  the one registered with Google exactly). */
export function googleRedirectUri(requestUrl: string): string {
  const origin = process.env.NODE_ENV === "production" ? "https://myfootballtracker.com" : new URL(requestUrl).origin;
  return `${origin}/api/auth/google/callback`;
}

export function googleAuthUrl(state: string, redirectUri: string): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
}

/** Trade the code for the fan's verified Google identity, or null. */
export async function googleProfile(code: string, redirectUri: string): Promise<GoogleProfile | null> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) return null;
  return checkIdToken(id_token, process.env.GOOGLE_CLIENT_ID ?? "");
}

/** Decode and check an ID token's claims. Pure, exported for tests. */
export function checkIdToken(idToken: string, clientId: string, now = Date.now()): GoogleProfile | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as {
      iss?: string;
      aud?: string;
      exp?: number;
      sub?: string;
      email?: string;
      email_verified?: boolean | string;
      name?: string;
      picture?: string;
    };
    const issuerOk = payload.iss === "https://accounts.google.com" || payload.iss === "accounts.google.com";
    const verified = payload.email_verified === true || payload.email_verified === "true";
    if (!issuerOk || !clientId || payload.aud !== clientId) return null;
    if (!payload.exp || payload.exp * 1000 < now) return null;
    if (!payload.sub || !payload.email || !verified) return null;
    return { sub: payload.sub, email: payload.email.toLowerCase(), name: payload.name ?? null, picture: payload.picture ?? null };
  } catch {
    return null;
  }
}

/** Only same-site paths are allowed as the place to return to. */
export function safeNext(raw: string | null | undefined): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") && raw.length < 300 ? raw : "/my-club";
}
