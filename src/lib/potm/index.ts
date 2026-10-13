import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { provider } from "@/lib/providers";
import { readyDb } from "@/lib/db/neon";
import { swr } from "@/lib/cache";
import { currentUser } from "@/lib/auth";
import type { Match } from "@/lib/providers/types";

/**
 * Player of the Match: one vote per fan per finished match (per account when
 * signed in, otherwise per device), open for 7 days after kickoff. Candidates
 * are both starting XIs plus substitutes who came on. Totals are memoised for a
 * few seconds so a busy match page doesn't hammer the database.
 */

export const VOTE_WINDOW_MS = 7 * 24 * 3600_000;
const VOTER_COOKIE = "mft_vid";

export interface Candidate {
  playerId: number;
  name: string;
  teamId: number;
  number?: number;
}

export interface Tally {
  playerId: number;
  name: string;
  teamId: number;
  votes: number;
}

export function voteOpen(match: Match, now = Date.now()): boolean {
  return match.status === "finished" && now - Date.parse(match.kickoffUtc) < VOTE_WINDOW_MS;
}

export async function candidates(matchId: number): Promise<Candidate[]> {
  const [lineups, events] = await Promise.all([
    provider.getLineups(matchId).catch(() => []),
    provider.getEvents(matchId).catch(() => []),
  ]);
  const cameOn = new Set(events.filter((e) => e.type === "sub" && e.playerId).map((e) => e.playerId!));
  const out: Candidate[] = [];
  for (const l of lineups) {
    for (const p of l.starters) if (p.playerId) out.push({ playerId: p.playerId, name: p.name, teamId: l.teamId, number: p.number });
    for (const p of l.bench) if (p.playerId && cameOn.has(p.playerId)) out.push({ playerId: p.playerId, name: p.name, teamId: l.teamId, number: p.number });
  }
  return out;
}

/** Stable voter key: the account when signed in, else a random device id cookie. */
export async function voterKey(create: boolean): Promise<string | null> {
  const user = await currentUser();
  if (user) return `u:${user.id}`;
  const jar = await cookies();
  let vid = jar.get(VOTER_COOKIE)?.value;
  if (!vid && create) {
    vid = randomBytes(16).toString("base64url");
    jar.set(VOTER_COOKIE, vid, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 400 * 24 * 3600 });
  }
  return vid ? `d:${vid}` : null;
}

export async function tallies(matchId: number): Promise<Tally[]> {
  return swr(`potm:${matchId}`, 10, async () => {
    const sql = await readyDb(3_000);
    if (!sql) return [];
    const rows = (await sql`
      select player_id, player_name, team_id, count(*)::int as votes
      from potm_votes where match_id = ${matchId}
      group by player_id, player_name, team_id
      order by votes desc, player_name asc
    `) as { player_id: number; player_name: string; team_id: number; votes: number }[];
    return rows.map((r) => ({ playerId: r.player_id, name: r.player_name, teamId: r.team_id, votes: r.votes }));
  });
}

export async function myVote(matchId: number, voter: string | null): Promise<number | null> {
  if (!voter) return null;
  const sql = await readyDb(3_000);
  if (!sql) return null;
  const rows = (await sql`select player_id from potm_votes where match_id = ${matchId} and voter = ${voter}`) as { player_id: number }[];
  return rows[0]?.player_id ?? null;
}

/** Record a vote (first vote stands). Returns false if already voted. */
export async function castVote(matchId: number, voter: string, c: Candidate): Promise<boolean> {
  const sql = await readyDb(5_000);
  if (!sql) throw new Error("database unavailable");
  const rows = (await sql`
    insert into potm_votes (match_id, voter, player_id, player_name, team_id)
    values (${matchId}, ${voter}, ${c.playerId}, ${c.name}, ${c.teamId})
    on conflict (match_id, voter) do nothing
    returning player_id
  `) as { player_id: number }[];
  return rows.length > 0;
}
