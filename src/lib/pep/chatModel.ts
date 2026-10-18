/**
 * Community chat with Pep: shared types and validation (pure, unit tested).
 * Fans must be signed in; text only (links are shown as plain text, never
 * clickable); Pep replies through his own key.
 */

export interface ChatMessage {
  id: number;
  at: string;
  author: string;
  role: "fan" | "pep";
  body: string;
  replyTo?: number;
}

export interface ChatState {
  messages: ChatMessage[];
  me: { signedIn: boolean; name: string | null };
  signInAvailable: boolean;
}

export const MAX_BODY = 280;

const clean = (s: string) =>
  s
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f​-‏‪-‮]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export function cleanBody(raw: unknown, max = MAX_BODY): { ok: true; body: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Write a message first." };
  const body = clean(raw);
  if (!body) return { ok: false, error: "Write a message first." };
  if (body.length > max) return { ok: false, error: `Keep it under ${max} characters.` };
  return { ok: true, body };
}

/** Names that would let a fan pass as Pep or staff. */
const RESERVED = /\b(pep|masceroni|admin|moderator|mod|staff|official|myfootballtracker|my football tracker|artem)\b/i;

export function cleanName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Pick a name for the chat." };
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 20) return { ok: false, error: "Names are 2 to 20 characters." };
  if (!/^[\p{L}\p{N} _.'-]+$/u.test(name)) return { ok: false, error: "Letters, numbers, spaces, dots and dashes only." };
  if (RESERVED.test(name)) return { ok: false, error: "That name is reserved. Pick another." };
  return { ok: true, name };
}
