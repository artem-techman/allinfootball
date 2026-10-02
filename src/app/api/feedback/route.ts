import { NextResponse } from "next/server";
import { db, readyDb } from "@/lib/db/neon";
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

/** Per-instance limiter: a few submissions per visitor IP per 10 minutes. */
const recent = new Map<string, number[]>();
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 5;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 5_000) recent.clear(); // bounded memory
  return hits.length > MAX_PER_WINDOW;
}

/** Only accept posts from our own pages (blocks drive-by cross-site spam). */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return NextResponse.json({ ok: false, error: "too many" }, { status: 429 });
  if (!db()) return NextResponse.json({ ok: false, error: "no_db" }, { status: 503 });
  const sql = await readyDb(8_000); // a suspended Neon compute can take a few seconds to wake
  if (!sql) return NextResponse.json({ ok: false }, { status: 502 });

  let body: {
    message?: string;
    rating?: number;
    email?: string;
    page?: string;
    sessionId?: string;
    /** Honeypot: a hidden field real visitors never fill. */
    website?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const { message, rating, email, page, sessionId, website } = body;
  // Pretend success to bots so they don't retry; store nothing.
  if (typeof website === "string" && website.trim() !== "") return NextResponse.json({ ok: true });
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
