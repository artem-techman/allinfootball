import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/legal/LegalLayout";
import { buildMetadata } from "@/lib/seo/metadata";

// The shared AppShell sidebar reads search params, so render on demand (matches
// the rest of the app); the content itself is static.
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description: "What My Football Tracker collects, why, and how to ask us to remove it.",
  path: "/privacy",
});

/**
 * Keep this page in step with what the code actually stores:
 *  - feedback: src/app/api/feedback/route.ts (message, rating, email, page,
 *    session_id, user_agent)
 *  - analytics: GA4 via NEXT_PUBLIC_GA_ID in src/app/layout.tsx
 *  - browser storage: sidebar, feedback-card and highlights-mute preferences
 */
export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="2 October 2026">
      <LegalSection heading="The short version">
        <p>
          There are no accounts on My Football Tracker, so there is no profile, password or login
          to collect. We measure page views with Google Analytics, and we store feedback only if you
          send it. We don&apos;t sell data and we don&apos;t run betting ads.
        </p>
      </LegalSection>

      <LegalSection heading="Page views (Google Analytics)">
        <p>
          We use Google Analytics 4 to count page views and understand which pages are useful.
          Google collects the pages you visit, the site that sent you, your device and browser type
          and an approximate location derived from your IP address, and sets cookies to tell visits
          apart. You can block these cookies in your browser or use Google&apos;s{" "}
          <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">
            opt-out add-on
          </a>
          ; the site works the same without them.
        </p>
      </LegalSection>

      <LegalSection heading="Feedback">
        <p>If you use the feedback form, we store:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>your message;</li>
          <li>a star rating, if you give one;</li>
          <li>your email address, if you give one (only so we can reply);</li>
          <li>the page you sent it from;</li>
          <li>a random id generated for that submission (not linked to you or to analytics);</li>
          <li>your browser&apos;s user-agent string (browser and device type).</li>
        </ul>
        <p>
          We use feedback only to fix and improve the site. It is never used for marketing or shared
          with advertisers. To have something you sent removed, email{" "}
          <a href="mailto:privacy@myfootballtracker.com">privacy@myfootballtracker.com</a>.
        </p>
      </LegalSection>

      <LegalSection heading="Stored in your browser">
        <p>
          A few display preferences stay on your device in local storage: whether the sidebar is
          collapsed, whether the feedback card is folded, and whether highlight videos start muted.
          We can&apos;t see them.
        </p>
      </LegalSection>

      <LegalSection heading="Other services">
        <p>
          Match data comes from API-Football; your browser doesn&apos;t talk to it directly. When
          you open a news story you go to the publisher&apos;s site, and when you play a highlight
          the video is served by YouTube. Their own privacy policies apply there.
        </p>
      </LegalSection>

      <LegalSection heading="Your rights">
        <p>
          Depending on where you live (for example under the UK or EU GDPR, or the CCPA), you can ask
          to see, correct or delete information about you. Email{" "}
          <a href="mailto:privacy@myfootballtracker.com">privacy@myfootballtracker.com</a>.
        </p>
      </LegalSection>

      <LegalSection heading="Changes">
        <p>
          If what we collect changes, we&apos;ll update this page and the date at the top.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
