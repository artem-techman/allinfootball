import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { currentUser, sameOrigin } from "@/lib/auth";
import { emailEnabled } from "@/lib/email";
import { displayName, hideMessage, postFan, postPep, readChat, setDisplayName } from "@/lib/pep/chat";
import { cleanBody, cleanName, type ChatState } from "@/lib/pep/chatModel";

/**
 * Community chat on /pep.
 *  GET  /api/pep/chat[?after=<id>]  → { messages, me, signInAvailable } (public read)
 *  POST /api/pep/chat
 *    fans (signed in, same origin): { text, name?, replyTo? }  (name once, to pick a chat name)
 *    Pep  (Bearer PEP_STATUS_TOKEN): { text, replyTo? } to reply, or { hide: <id> } to moderate
 */
export const dynamic = "force-dynamic";

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  const after = Number(new URL(request.url).searchParams.get("after")) || undefined;
  const [messages, user] = await Promise.all([readChat(80, after), currentUser().catch(() => null)]);
  const name = user ? await displayName(user.id).catch(() => null) : null;
  const state: ChatState = { messages, me: { signedIn: Boolean(user), name }, signInAvailable: emailEnabled() };
  return json(state);
}

function isPep(request: Request): boolean {
  const token = process.env.PEP_STATUS_TOKEN;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token || !given) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

const replyId = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : undefined);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { text?: unknown; name?: unknown; replyTo?: unknown; hide?: unknown };

  // Pep (his key, from his own machine).
  if (request.headers.get("authorization")) {
    if (!isPep(request)) return json({ error: "unauthorized" }, 401);
    if (body.hide != null) {
      const id = replyId(body.hide);
      return id && (await hideMessage(id)) ? json({ ok: true, hidden: id }) : json({ error: "no such message" }, 404);
    }
    const text = cleanBody(body.text, 600);
    if (!text.ok) return json({ error: text.error }, 400);
    const r = await postPep(text.body, replyId(body.replyTo));
    return r.ok ? json({ ok: true, message: r.message }) : json({ error: r.error }, r.status);
  }

  // Fans: signed in, from our own pages.
  if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
  const user = await currentUser();
  if (!user) return json({ error: "Sign in to chat." }, 401);
  let name = await displayName(user.id);
  if (!name) {
    const n = cleanName(body.name);
    if (!n.ok) return json({ error: n.error, needName: true }, 400);
    name = n.name;
    await setDisplayName(user.id, name);
  }
  const text = cleanBody(body.text);
  if (!text.ok) return json({ error: text.error }, 400);
  const r = await postFan(user.id, name, text.body, replyId(body.replyTo));
  return r.ok ? json({ ok: true, message: r.message, name }) : json({ error: r.error }, r.status);
}
