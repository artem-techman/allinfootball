import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/legal/LegalLayout";
import { buildMetadata } from "@/lib/seo/metadata";
import { competitionCountWord, competitionListSentence } from "@/lib/seo/copy";
import { getFeeds } from "@/lib/news/feeds";

// The shared AppShell sidebar reads search params, so render on demand (matches
// the rest of the app); the content itself is static.
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "About",
  description: `About My Football Tracker: live scores, tables, lineups and stats across ${competitionCountWord()} of the world's biggest football competitions. No betting ads, ever.`,
  path: "/about",
});

/** "BBC Sport, The Guardian and Sky Sports" — the news sources actually in use. */
function newsSources(): string {
  const names = getFeeds().map((f) => f.name);
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export default function AboutPage() {
  return (
    <LegalLayout title="About My Football Tracker">
      <LegalSection heading="What we do">
        <p>
          My Football Tracker is a fast, free football companion. We bring live scores, league
          tables, fixtures, results, lineups, match stats and headlines together in one clean place
          so you can follow the game without the clutter.
        </p>
        <p>
          <strong>No betting ads, ever.</strong> We don&apos;t show gambling promotions, bookmaker
          offers or affiliate links.
        </p>
      </LegalSection>

      <LegalSection heading="Competitions we cover">
        <p>
          We focus on {competitionCountWord()} of the world&apos;s biggest competitions:{" "}
          {competitionListSentence()}.
        </p>
      </LegalSection>

      <LegalSection heading="Where our data comes from">
        <p>
          Match data, fixtures, tables and statistics are provided by API-Football. News is
          aggregated as headlines from {newsSources()}. We show the headline and a short summary,
          and always link out to the original publisher for the full story. Match highlights link
          to official video on YouTube. Club and competition crests belong to their respective
          owners.
        </p>
      </LegalSection>

      <LegalSection heading="No account needed">
        <p>
          You can use everything on My Football Tracker without signing up or logging in. We keep it
          simple and free.
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
