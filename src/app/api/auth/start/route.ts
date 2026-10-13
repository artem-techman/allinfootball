import { NextResponse } from "next/server";
import { createLoginCode, normalizeEmail, sameOrigin } from "@/lib/auth";
import { emailEnabled, escapeHtml, layout, sendEmail } from "@/lib/email";

/** POST /api/auth/start {email} — email a 6-digit sign-in code. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = normalizeEmail(body.email);
  if (!email) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  if (!emailEnabled() && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "email_unavailable" }, { status: 503 });
  }
  try {
    const issued = await createLoginCode(email);
    if ("error" in issued) return NextResponse.json({ error: issued.error }, { status: 429 });
    const code = issued.code;
    await sendEmail({
      to: email,
      subject: `${code} is your My Football Tracker code`,
      text: `Your sign-in code is ${code}. It expires in 10 minutes. If you didn't ask for it, ignore this email.`,
      html: layout(
        `<p style="margin:0 0 14px;font-size:15px">Your sign-in code:</p>
         <p style="margin:0 0 18px;font-size:38px;font-weight:800;letter-spacing:.18em;color:#cdf24a">${escapeHtml(code)}</p>
         <p style="margin:0;font-size:14px;color:#a8adb5">It expires in 10 minutes.</p>`,
        "If you didn't ask for this code, you can ignore this email.",
      ),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
