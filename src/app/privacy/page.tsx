import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/legal/LegalLayout";

// The shared AppShell sidebar reads search params, so render on demand (matches
// the rest of the app); the content itself is static.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How My Football Tracker handles your data, cookies and analytics.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="30 June 2026">
      <LegalSection heading="Overview">
        <p>
          This Privacy Policy explains what information My Football Tracker
          (&quot;we&quot;, &quot;us&quot;) collects when you use myfootballtracker.com (the
          &quot;Service&quot;), how we use it, and the choices you have. We aim to collect as little
          as possible.
        </p>
      </LegalSection>

      <LegalSection heading="No accounts">
        <p>
          The Service does not require registration or a login. We do not ask for your name, email
          or password to browse the site, and we do not collect that information unless you choose to
          email us.
        </p>
      </LegalSection>

      <LegalSection heading="Information we collect">
        <p>
          <strong>Analytics data.</strong> We use Google Analytics (GA4) to understand how the
          Service is used. This collects information such as the pages you view, the approximate
          (city-level) location derived from your IP address, your device and browser type, and the
          site that referred you. This data is aggregated and is not used to personally identify you.
        </p>
        <p>
          <strong>Local preferences.</strong> We store a small preference in your browser&apos;s
          local storage — whether the sidebar is collapsed. This stays on your device and is never
          sent to our servers.
        </p>
      </LegalSection>

      <LegalSection heading="Cookies">
        <p>
          Google Analytics sets cookies to measure usage. You can block or delete cookies in your
          browser settings, or install Google&apos;s{" "}
          <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">
            opt-out browser add-on
          </a>
          . Blocking these cookies will not affect your ability to use the Service.
        </p>
      </LegalSection>

      <LegalSection heading="Third-party services">
        <p>
          We rely on third parties whose own privacy policies apply: Google Analytics for usage
          measurement; API-Football for match data; news publishers (such as BBC Sport, The Guardian,
          Sky Sports and 90min) when you click through to a story; and YouTube/Google when you watch
          a match highlight. We are not responsible for the privacy practices of these external
          sites.
        </p>
      </LegalSection>

      <LegalSection heading="How we use information">
        <p>
          We use analytics data only to measure traffic, understand which features are useful, and
          improve the Service. We do not sell your personal information, and we do not use it for
          advertising profiles.
        </p>
      </LegalSection>

      <LegalSection heading="Your rights">
        <p>
          Depending on where you live (for example, under the GDPR or CCPA), you may have the right
          to access, correct or delete information relating to you, or to object to its processing.
          Because we do not hold accounts, most data is anonymous analytics; to make a request,
          contact us at{" "}
          <a href="mailto:privacy@myfootballtracker.com">privacy@myfootballtracker.com</a>.
        </p>
      </LegalSection>

      <LegalSection heading="Children">
        <p>
          The Service is intended for a general audience and is not directed at children under 13. We
          do not knowingly collect personal information from children.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to this policy">
        <p>
          We may update this policy from time to time. Material changes will be reflected by updating
          the &quot;Last updated&quot; date above.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about privacy? Email{" "}
          <a href="mailto:privacy@myfootballtracker.com">privacy@myfootballtracker.com</a>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
