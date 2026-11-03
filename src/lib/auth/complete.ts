import "server-only";
import { markSignIn, startSession, updateUser, type User } from "@/lib/auth";
import { clubFromCookie, resolveClub, setClubCookie } from "@/lib/club";
import { linkVisitorPicks, recordClubPick, requestCountry } from "@/lib/club/picks";

/**
 * Everything that happens once a fan has proved who they are (email code or
 * Google), in route handlers only: start the session, attach this browser's
 * club picks to the account, and reconcile the club — a club picked before
 * signing in is saved to the account; otherwise the account's club is restored.
 */
export async function completeSignIn(user: User, method: "google" | "email"): Promise<User> {
  await startSession(user.id);
  await Promise.all([markSignIn(user.id, method, await requestCountry()).catch(() => {}), linkVisitorPicks(user.id)]);
  const local = await clubFromCookie();
  if (local && local.id !== user.clubTeamId) {
    const club = await resolveClub(local.id);
    if (club) {
      user = (await updateUser(user.id, { club })) ?? user;
      await recordClubPick("existing", club, user.id);
    }
  } else if (!local && user.clubTeamId && user.clubTeamName) {
    await setClubCookie({ id: user.clubTeamId, name: user.clubTeamName, crest: user.clubCrest ?? undefined });
  }
  return user;
}
