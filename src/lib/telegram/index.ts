import "server-only";

/**
 * Telegram Bot API (no SDK). The bot is an admin of the channel and posts with
 * HTML formatting. TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL (@handle or numeric
 * id) are server-side env vars.
 */

export function telegramEnabled(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNEL);
}

async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok) throw new Error(`telegram ${method}: ${data.description ?? res.status}`);
  return data.result as T;
}

const chat = () => process.env.TELEGRAM_CHANNEL!;

export async function postText(html: string, preview = false): Promise<number> {
  const r = await call<{ message_id: number }>("sendMessage", {
    chat_id: chat(),
    text: html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: !preview },
  });
  return r.message_id;
}

export async function postPhoto(url: string, captionHtml: string): Promise<number> {
  const r = await call<{ message_id: number }>("sendPhoto", {
    chat_id: chat(),
    photo: url,
    caption: captionHtml,
    parse_mode: "HTML",
  });
  return r.message_id;
}
