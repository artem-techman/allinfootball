import "server-only";
import { cookies } from "next/headers";
import { provider } from "@/lib/providers";
import { getCompetitionByLeagueId } from "@/lib/constants/competitions";
import { seasonYearFor } from "@/lib/season";
import type { Match, Standing } from "@/lib/providers/types";

/**
 * "My Club": the team a fan follows. Kept in a small first-party cookie so any
 * page can render it on the server with no database read; for signed-in fans
 * it's also saved on their account (and restored on any device at login).
 */

export const CLUB_COOKIE = "mft_club";

export interface Club {
  id: number;
  name: string;
  crest?: string;
}

export async function clubFromCookie(): Promise<Club | null> {
  const raw = (await cookies()).get(CLUB_COOKIE)?.value;
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Club;
    return Number.isFinite(c.id) && typeof c.name === "string" ? c : null;
  } catch {
    return null;
  }
}

export async function setClubCookie(club: Club | null): Promise<void> {
  const jar = await cookies();
  if (!club) {
    jar.delete(CLUB_COOKIE);
    return;
  }
  jar.set(CLUB_COOKIE, JSON.stringify(club), {
    httpOnly: false, // harmless public preference; readable by the page
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 400 * 24 * 3600,
  });
}

/** Resolve a team id to a club we cover (in-scope fixtures), with name + crest. */
export async function resolveClub(teamId: number): Promise<Club | null> {
  if (!Number.isFinite(teamId)) return null;
  const [next, last] = await Promise.all([
    provider.getTeamFixtures(teamId, { next: 1 }).catch(() => [] as Match[]),
    provider.getTeamFixtures(teamId, { last: 1 }).catch(() => [] as Match[]),
  ]);
  const m = next[0] ?? last[0];
  if (!m) return null;
  const t = m.homeTeamId === teamId ? m.homeTeam : m.awayTeam;
  return t ? { id: t.id, name: t.name, crest: t.crest } : null;
}

export interface ClubOverview {
  club: Club;
  live: Match | null;
  next: Match | null;
  recent: Match[];
  upcoming: Match[];
  table: { competition: string; slug: string; rows: Standing[] } | null;
}

/** Everything the My Club page and widget show — all from stored data (no provider calls). */
export async function clubOverview(club: Club): Promise<ClubOverview> {
  const [recent, upcomingAll] = await Promise.all([
    provider.getTeamFixtures(club.id, { last: 6 }).catch(() => [] as Match[]),
    provider.getTeamFixtures(club.id, { next: 6 }).catch(() => [] as Match[]),
  ]);
  const live = upcomingAll.find((m) => m.status === "live" || m.status === "ht") ?? null;
  const upcoming = upcomingAll.filter((m) => m.status === "scheduled");

  // The table of the competition the club plays most in (a league over a cup).
  const counts = new Map<number, number>();
  for (const m of [...recent, ...upcomingAll]) counts.set(m.competitionId, (counts.get(m.competitionId) ?? 0) + 1);
  const leagueId = [...counts.entries()]
    .sort((a, b) => {
      const ta = getCompetitionByLeagueId(a[0])?.type === "league" ? 1 : 0;
      const tb = getCompetitionByLeagueId(b[0])?.type === "league" ? 1 : 0;
      return tb - ta || b[1] - a[1];
    })[0]?.[0];
  const comp = leagueId ? getCompetitionByLeagueId(leagueId) : undefined;
  const rows = comp ? await provider.getStandings(comp.leagueId, seasonYearFor(comp)).catch(() => [] as Standing[]) : [];
  // The club's own group (cups / Nations League) or the whole league.
  const mine = rows.find((r) => r.teamId === club.id);
  const scoped = mine?.groupLabel ? rows.filter((r) => r.groupLabel === mine.groupLabel) : rows;

  return {
    club,
    live,
    next: upcoming[0] ?? null,
    recent,
    upcoming: upcoming.slice(0, 5),
    table: comp && scoped.length ? { competition: comp.name, slug: comp.slug, rows: scoped } : null,
  };
}
