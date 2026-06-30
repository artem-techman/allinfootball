import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/legal/LegalLayout";

// The shared AppShell sidebar reads search params, so render on demand (matches
// the rest of the app); the content itself is static.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About",
  description:
    "About My Football Tracker — live scores, tables, lineups and stats across nine of the world's biggest football competitions.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <LegalLayout title="About My Football Tracker">
      <LegalSection heading="What we do">
        <p>
          My Football Tracker is a fast, free football companion. We bring live scores, league
          tables, fixtures, results, lineups, match stats and headlines together in one clean place
          so you can follow the game without the clutter.
        </p>
      </LegalSection>

      <LegalSection heading="Competitions we cover">
        <p>
          We focus on nine of the world&apos;s biggest competitions: the Premier League, La Liga,
          Serie A, Bundesliga, Ligue 1, the UEFA Champions League, the UEFA Europa League, Major
          League Soccer and the FIFA World Cup.
        </p>
      </LegalSection>

      <LegalSection heading="Where our data comes from">
        <p>
          Match data, fixtures, tables and statistics are provided by API-Football. News is
          aggregated as headlines from trusted sources such as BBC Sport, The Guardian, Sky Sports
          and 90min — we always link out to the original publisher for the full story. Match
          highlights link to official video on YouTube. Club and competition crests belong to their
          respective owners.
        </p>
      </LegalSection>

      <LegalSection heading="No account needed">
        <p>
          You can use everything on My Football Tracker without signing up or logging in. We keep it
          simple and free.
        </p>
      </LegalSection>

      <LegalSection heading="Advertise with us">
        <p>
          Want to reach a passionate football audience? Email{" "}
          <a href="mailto:ads@myfootballtracker.com">ads@myfootballtracker.com</a> and we&apos;ll
          send over our media kit.
        </p>
      </LegalSection>

      <LegalSection heading="Get in touch">
        <p>
          Questions, corrections or feedback? Reach us at{" "}
          <a href="mailto:hello@myfootballtracker.com">hello@myfootballtracker.com</a>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
