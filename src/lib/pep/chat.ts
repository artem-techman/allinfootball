import "server-only";
import { readyDb, withTimeout } from "@/lib/db/neon";
import type { ChatMessage } from "./chatModel";

/** A fan can post once every few seconds and a few dozen times an hour. */
const FAN_GAP_S = 6;
const FAN_PER_HOUR = 40;
const PEP_PER_HOUR = 120;

type Row = { id: string | number; at: string; author: string; role: "fan" | "pep"; body: string; reply_to: string | number | null };
const toMsg = (r: Row): ChatMessage => ({
  id: Number(r.id),
  at: new Date(r.at).toISOString(),
  author: r.author,
  role: r.role,
  body: r.body,
  ...(r.reply_to != null ? { replyTo: Number(r.reply_to) } : {}),
});

/** The latest visible messages, oldest first. */
export async function readChat(limit = 80, afterId?: number): Promise<ChatMessage[]> {
  const sql = await readyDb(2_500);
  if (!sql) return [];
  try {
    const rows = (await withTimeout(
      (afterId
        ? sql`select id, at, author, role, body, reply_to from pep_chat where hidden = false and id > ${afterId} order by id asc limit ${limit}`
        : sql`select * from (select id, at, author, role, body, reply_to from pep_chat where hidden = false order by id desc limit ${limit}) t order by id asc`) as unknown as Promise<Row[]>,
      3_000,
      [],
    )) as Row[];
    return rows.map(toMsg);
  } catch {
    return [];
  }
}

export async function displayName(userId: number): Promise<string | null> {
  const sql = await readyDb(2_500);
  if (!sql) return null;
  const rows = (await sql`select display_name from users where id = ${userId}`) as { display_name: string | null }[];
  return rows[0]?.display_name ?? null;
}

export async function setDisplayName(userId: number, name: string): Promise<void> {
  const sql = await readyDb(2_500);
  if (sql) await sql`update users set display_name = ${name} where id = ${userId}`;
}

type PostResult = { ok: true; message: ChatMessage } | { ok: false; status: number; error: string };

export async function postFan(userId: number, author: string, body: string, replyTo?: number): Promise<PostResult> {
  const sql = await readyDb(4_000);
  if (!sql) return { ok: false, status: 503, error: "Chat is unavailable right now." };
  const recent = (await sql`
    select count(*) filter (where at > now() - make_interval(secs => ${FAN_GAP_S}))::int as burst,
           count(*)::int as hour
    from pep_chat where user_id = ${userId} and at > now() - interval '1 hour'
  `) as { burst: number; hour: number }[];
  if ((recent[0]?.burst ?? 0) > 0) return { ok: false, status: 429, error: "Slow down a little." };
  if ((recent[0]?.hour ?? 0) >= FAN_PER_HOUR) return { ok: false, status: 429, error: "That's a lot of messages. Take a breather." };
  const rows = (await sql`
    insert into pep_chat (user_id, author, role, body, reply_to)
    values (${userId}, ${author}, 'fan', ${body}, ${replyTo ?? null})
    returning id, at, author, role, body, reply_to
  `) as Row[];
  return { ok: true, message: toMsg(rows[0]) };
}

export async function postPep(body: string, replyTo?: number): Promise<PostResult> {
  const sql = await readyDb(4_000);
  if (!sql) return { ok: false, status: 503, error: "database unavailable" };
  const recent = (await sql`select count(*)::int as n from pep_chat where role = 'pep' and at > now() - interval '1 hour'`) as { n: number }[];
  if ((recent[0]?.n ?? 0) >= PEP_PER_HOUR) return { ok: false, status: 429, error: `at most ${PEP_PER_HOUR} replies an hour` };
  const rows = (await sql`
    insert into pep_chat (author, role, body, reply_to)
    values ('Pep', 'pep', ${body}, ${replyTo ?? null})
    returning id, at, author, role, body, reply_to
  `) as Row[];
  return { ok: true, message: toMsg(rows[0]) };
}

/** Moderation: hide a message from the public chat (kept in the table, never deleted). */
export async function hideMessage(id: number): Promise<boolean> {
  const sql = await readyDb(4_000);
  if (!sql) return false;
  const rows = (await sql`update pep_chat set hidden = true where id = ${id} returning id`) as { id: number }[];
  return rows.length > 0;
}
