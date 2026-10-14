import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { ClubDashboard } from "@/components/club/ClubDashboard";
import { MyClubOnboarding } from "@/components/club/MyClubOnboarding";
import { AccountPanel } from "@/components/club/AccountPanel";
import { clubFromCookie, clubOverview } from "@/lib/club";
import { currentUser } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo/metadata";
import { emailEnabled } from "@/lib/email";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...buildMetadata({ title: "My Club", description: "Your club's next match, results and table.", path: "/my-club" }),
  robots: { index: false, follow: true },
};

/**
 * My Club. No club yet → pick one, then sign in by email code (skippable).
 * With a club → its dashboard, plus the account box (sign in, matchday email).
 * All match data comes from stored reads — no provider calls.
 */
export default async function MyClubPage() {
  const [club, user] = await Promise.all([clubFromCookie(), currentUser()]);
  if (!club) {
    return (
      <AppShell>
        <h1 className="mb-5 text-greeting text-text-primary">My Club</h1>
        <MyClubOnboarding signedIn={user != null} canSignIn={emailEnabled()} />
      </AppShell>
    );
  }
  const overview = await clubOverview(club);
  return (
    <AppShell
      rail={<AccountPanel email={user?.email ?? null} matchdayEmail={user?.matchdayEmail ?? true} clubName={club.name} canSignIn={emailEnabled()} />}
    >
      <ClubDashboard overview={overview} />
    </AppShell>
  );
}
