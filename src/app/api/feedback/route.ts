import { NextResponse } from "next/server";
import { db } from "@/lib/db/neon";
import { isValidEmailOptional, isValidMessage, isValidRating, MESSAGE_MAX } from "@/lib/feedback/config";

/**
 * Feedback API (Neon-backed).
 *   POST /api/feedback {message, rating?, email?, page?, sessionId?} → { ok }
 *
 * Stores visitor feedback server-side (the database is never exposed to the
 * browser). Message is required; rating (1–5) and email are optional. Returns
 * 503 when no database is configured so the widget can tell the difference
 * between "saved" and "not saved" rather than silently dropping feedback.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const sql = db();
  if (!sql) return NextResponse.json({ ok: false, error: "no_db" }, { status: 503 });

  let body: {
    message?: string;
    rating?: number;
    email?: string;
    page?: string;
    sessionId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const { message, rating, email, page, sessionId } = body;
  if (!isValidMessage(message) || !isValidRating(rating) || !isValidEmailOptional(email)) {
    return NextResponse.json({ ok: false, error: "invalid feedback" }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 400) ?? null;
  const cleanEmail = email && email.trim() ? email.trim().toLowerCase() : null;
  const cleanPage = typeof page === "string" ? page.slice(0, 200) : null;
  const cleanSession = typeof sessionId === "string" ? sessionId.slice(0, 64) : null;

  try {
    await sql`
      insert into feedback (message, rating, email, page, session_id, user_agent)
      values (
        ${message.trim().slice(0, MESSAGE_MAX)},
        ${rating ?? null},
        ${cleanEmail},
        ${cleanPage},
        ${cleanSession},
        ${userAgent}
      )
    `;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
