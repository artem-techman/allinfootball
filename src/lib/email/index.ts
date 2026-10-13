import "server-only";

/**
 * Transactional email via Resend's REST API (no SDK). Needs RESEND_API_KEY and a
 * verified sending domain (myfootballtracker.com). Without a key, emailEnabled()
 * is false: login explains it's unavailable, and in development codes are
 * printed to the server log instead.
 */

const FROM = process.env.EMAIL_FROM ?? "My Football Tracker <hello@myfootballtracker.com>";
export const SITE_URL = "https://myfootballtracker.com";

export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(msg: {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl?: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production") console.info(`[email:dev] to=${msg.to} subject=${msg.subject}\n${msg.text}`);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      ...(msg.unsubscribeUrl
        ? { headers: { "List-Unsubscribe": `<${msg.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }
        : {}),
    }),
    cache: "no-store",
  });
  if (!res.ok) console.warn(`[email] send failed ${res.status}`);
  return res.ok;
}

/** Minimal branded wrapper: dark header, readable body, footer with unsubscribe. */
export function layout(body: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;background:#0b0c0e;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#e8eaed">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0c0e;padding:24px 12px">
<tr><td align="center"><table role="presentation" width="100%" style="max-width:520px;background:#15171a;border-radius:18px;overflow:hidden">
<tr><td style="padding:22px 26px;background:linear-gradient(90deg,#16a34a,#cdf24a);color:#0b0c0e;font-weight:800;font-size:15px;letter-spacing:.04em">MY FOOTBALL TRACKER</td></tr>
<tr><td style="padding:26px">${body}</td></tr>
<tr><td style="padding:18px 26px;border-top:1px solid #23262b;font-size:12px;color:#8b9099">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
