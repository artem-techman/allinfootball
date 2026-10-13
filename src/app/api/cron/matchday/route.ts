import { NextResponse } from "next/server";
import { provider } from "@/lib/providers";
import { readyDb } from "@/lib/db/neon";
import { emailEnabled, sendEmail, SITE_URL } from "@/lib/email";
import { preMatchEmail, resultEmail } from "@/lib/email/matchday";
import type { Match } from "@/lib/providers/types";

/**
 * GET /api/cron/matchday — every 5 minutes (Vercel Cron, CRON_SECRET). For each
 * followed club with subscribers:
 *  - pre-match: once line-ups are out (~1h before), or 35 min before kickoff
 *    without them;
 *  - result: once the match is final (within 8h of kickoff).
 * Each (user, match, kind) is logged BEFORE sending, so a send happens at most
 * once even if runs overlap. All match data comes from stored reads.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MIN = 60_000;

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!emailEnabled()) return NextResponse.json({ skipped: "email not configured" });
  const sql = await readyDb(8_000);
  if (!sql) return NextResponse.json({ error: "database unavailable" }, { status: 503 });

  const subs = (await sql`
    select id, email, club_team_id, club_team_name, unsubscribe_token from users
    where matchday_email and club_team_id is not null
  `) as { id: number; email: string; club_team_id: number; club_team_name: string; unsubscribe_token: string }[];

  const byClub = new Map<number, typeof subs>();
  for (const u of subs) (byClub.get(u.club_team_id) ?? byClub.set(u.club_team_id, []).get(u.club_team_id)!).push(u);

  const now = Date.now();
  let sent = 0;
  for (const [clubId, users] of byClub) {
    const [next, last] = await Promise.all([
      provider.getTeamFixtures(clubId, { next: 1 }).catch(() => [] as Match[]),
      provider.getTeamFixtures(clubId, { last: 1 }).catch(() => [] as Match[]),
    ]);

    const upcoming = next[0];
    if (upcoming && upcoming.status === "scheduled") {
      const toKo = Date.parse(upcoming.kickoffUtc) - now;
      if (toKo > 0 && toKo <= 75 * MIN) {
        const lineups = await provider.getLineups(upcoming.id).catch(() => []);
        if (lineups.length >= 2 || toKo <= 35 * MIN) {
          sent += await deliver(sql, users, upcoming.id, "pre", (unsub) =>
            preMatchEmail(users[0].club_team_name, upcoming, lineups.length >= 2 ? lineups : [], unsub),
          );
        }
      }
    }

    const done = last[0];
    if (done && done.status === "finished" && now - Date.parse(done.kickoffUtc) <= 8 * 60 * MIN) {
      const events = await provider.getEvents(done.id).catch(() => []);
      sent += await deliver(sql, users, done.id, "post", (unsub) => resultEmail(users[0].club_team_name, done, events, unsub));
    }
  }
  return NextResponse.json({ clubs: byClub.size, subscribers: subs.length, sent });
}

async function deliver(
  sql: NonNullable<Awaited<ReturnType<typeof readyDb>>>,
  users: { id: number; email: string; unsubscribe_token: string }[],
  matchId: number,
  kind: "pre" | "post",
  build: (unsubscribeUrl: string) => { subject: string; html: string; text: string },
): Promise<number> {
  let n = 0;
  for (const u of users) {
    const claimed = (await sql`
      insert into email_log (user_id, match_id, kind) values (${u.id}, ${matchId}, ${kind})
      on conflict do nothing returning user_id
    `) as unknown[];
    if (!claimed.length) continue; // already sent (or claimed by an overlapping run)
    const unsub = `${SITE_URL}/unsubscribe?token=${encodeURIComponent(u.unsubscribe_token)}`;
    const content = build(unsub);
    if (await sendEmail({ to: u.email, ...content, unsubscribeUrl: `${SITE_URL}/api/email/unsubscribe?token=${encodeURIComponent(u.unsubscribe_token)}` })) n += 1;
  }
  return n;
}
