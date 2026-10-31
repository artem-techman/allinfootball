import "server-only";

/**
 * Telegram Bot API (no SDK). The bot is an admin of the channel and posts with
 * HTML formatting. TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL (@handle or numeric
 * id) are server-side env vars.
 */

export function telegramEnabled(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNEL);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One Bot API call. JSON bodies, or FormData for file uploads. When Telegram
 * says "Too Many Requests: retry after N" (posting several messages in one
 * run), wait N seconds and try once more instead of losing the post.
 */
async function call<T>(method: string, body: Record<string, unknown> | FormData, retried = false): Promise<T> {
  const form = body instanceof FormData;
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    ...(form ? {} : { headers: { "Content-Type": "application/json" } }),
    body: form ? body : JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json()) as { ok: boolean; result?: T; description?: string; parameters?: { retry_after?: number } };
  if (!data.ok) {
    const wait = data.parameters?.retry_after;
    if (!retried && res.status === 429 && wait && wait <= 20) {
      await sleep(wait * 1000 + 300);
      return call<T>(method, body, true);
    }
    throw new Error(`telegram ${method}: ${data.description ?? res.status}`);
  }
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

/**
 * Post our own image (a result card) by UPLOADING it. Passing the URL made
 * Telegram fetch it as a robot, and robots only get saved data: right after
 * full time the match isn't archived yet, so the card failed ("failed to get
 * HTTP URL content") and 11 results were never posted (Oct 2026). We fetch it
 * ourselves as the server. If the card can't be made, the caption goes out as
 * a text post, so the result is never lost.
 */
export async function postPhoto(url: string, captionHtml: string): Promise<number> {
  let image: Blob | null = null;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const type = res.headers.get("content-type") ?? "";
    if (res.ok && type.startsWith("image/")) image = await res.blob();
  } catch {
    image = null;
  }
  if (!image) return postText(captionHtml);
  const form = new FormData();
  form.set("chat_id", chat());
  form.set("caption", captionHtml);
  form.set("parse_mode", "HTML");
  form.set("photo", image, "result.png");
  const r = await call<{ message_id: number }>("sendPhoto", form);
  return r.message_id;
}

/**
 * A video post without hosting the video: the official YouTube link is the
 * message's preview, shown large ABOVE the caption, and plays inside Telegram on
 * phones. (We never download or re-upload footage — rights holders' content
 * stays on their channels; see CLAUDE.md section 17.)
 */
export async function postVideoLink(url: string, captionHtml: string): Promise<number> {
  const r = await call<{ message_id: number }>("sendMessage", {
    chat_id: chat(),
    text: captionHtml,
    parse_mode: "HTML",
    link_preview_options: { url, prefer_large_media: true, show_above_text: true },
  });
  return r.message_id;
}
