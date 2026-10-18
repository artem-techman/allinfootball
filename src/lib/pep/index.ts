import "server-only";
import { readyDb, withTimeout } from "@/lib/db/neon";
import type { PepActivity, PepKind, PepState } from "./model";

/** Most reports Pep may file in an hour (a stuck loop can't flood the page). */
const MAX_PER_HOUR = 40;

export async function readPep(limit = 40): Promise<PepState> {
  const now = new Date().toISOString();
  const empty: PepState = { current: null, timeline: [], scoreboard: null, now };
  const sql = await readyDb(2_500);
  if (!sql) return empty;
  try {
    const [rows, score] = await Promise.all([
      withTimeout(
        sql`select id, at, kind, title, detail, link from pep_activity order by at desc, id desc limit ${limit}` as unknown as Promise<
          { id: string | number; at: string; kind: PepKind; title: string; detail: string | null; link: string | null }[]
        >,
        3_000,
        [],
      ),
      withTimeout(
        sql`select monthly_visitors, at from pep_scoreboard order by at desc, id desc limit 1` as unknown as Promise<{ monthly_visitors: number; at: string }[]>,
        3_000,
        [],
      ),
    ]);
    const timeline: PepActivity[] = rows.map((r) => ({
      id: Number(r.id),
      at: new Date(r.at).toISOString(),
      kind: r.kind,
      title: r.title,
      ...(r.detail ? { detail: r.detail } : {}),
      ...(r.link ? { link: r.link } : {}),
    }));
    return {
      current: timeline[0] ?? null,
      timeline,
      scoreboard: score[0] ? { monthlyVisitors: Number(score[0].monthly_visitors), at: new Date(score[0].at).toISOString() } : null,
      now,
    };
  } catch {
    return empty;
  }
}

export async function recordPep(
  activity: { kind: PepKind; title: string; detail?: string; link?: string },
  monthlyVisitors?: number,
): Promise<{ ok: true; id: number } | { ok: false; status: number; error: string }> {
  const sql = await readyDb(5_000);
  if (!sql) return { ok: false, status: 503, error: "database unavailable" };
  const recent = (await sql`select count(*)::int as n from pep_activity where at > now() - interval '1 hour'`) as { n: number }[];
  if ((recent[0]?.n ?? 0) >= MAX_PER_HOUR) return { ok: false, status: 429, error: `at most ${MAX_PER_HOUR} reports an hour` };
  const rows = (await sql`
    insert into pep_activity (kind, title, detail, link)
    values (${activity.kind}, ${activity.title}, ${activity.detail ?? null}, ${activity.link ?? null})
    returning id
  `) as { id: string | number }[];
  if (monthlyVisitors != null) await sql`insert into pep_scoreboard (monthly_visitors) values (${monthlyVisitors})`;
  return { ok: true, id: Number(rows[0].id) };
}
