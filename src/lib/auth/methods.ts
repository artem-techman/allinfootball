import "server-only";
import { emailEnabled } from "@/lib/email";
import { googleEnabled } from "@/lib/auth/google";

/** Which ways to sign in are switched on (each needs its own keys). */
export interface SignInMethods {
  google: boolean;
  email: boolean;
}

export function signInMethods(): SignInMethods {
  return { google: googleEnabled(), email: emailEnabled() };
}

export function canSignIn(): boolean {
  const m = signInMethods();
  return m.google || m.email;
}
