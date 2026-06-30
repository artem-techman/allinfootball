import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/legal/LegalLayout";

// The shared AppShell sidebar reads search params, so render on demand (matches
// the rest of the app); the content itself is static.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms governing your use of My Football Tracker.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="30 June 2026">
      <LegalSection heading="Acceptance of terms">
        <p>
          By accessing or using myfootballtracker.com (the &quot;Service&quot;), you agree to these
          Terms of Service. If you do not agree, please do not use the Service.
        </p>
      </LegalSection>

      <LegalSection heading="The service">
        <p>
          My Football Tracker provides football scores, fixtures, tables, statistics and aggregated
          news headlines for informational purposes. The Service is free to use and provided on an
          &quot;as is&quot; and &quot;as available&quot; basis.
        </p>
      </LegalSection>

      <LegalSection heading="Accuracy of information">
        <p>
          Match data is sourced from third parties and may be delayed, incomplete or inaccurate. We
          do not guarantee that scores, statistics, tables or any other content are correct or
          up to date, and you should not rely on the Service for betting, financial or other
          consequential decisions.
        </p>
      </LegalSection>

      <LegalSection heading="No betting services">
        <p>
          The Service does not offer betting, gambling or wagering of any kind. Where odds are
          displayed, they are presented as neutral reference data only and do not constitute advice
          or an invitation to bet.
        </p>
      </LegalSection>

      <LegalSection heading="Intellectual property">
        <p>
          The My Football Tracker name, logo and site design are our property. News headlines and
          articles remain the property of their respective publishers — we display headlines and
          link out to the original source. Club and competition crests, team names and player names
          are the property of their respective owners and are used for identification only.
        </p>
      </LegalSection>

      <LegalSection heading="Third-party links and content">
        <p>
          The Service links to external websites and embeds third-party content (such as news
          articles and YouTube highlights). We do not control and are not responsible for the
          content, policies or availability of those third parties.
        </p>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>
          You agree not to scrape, copy, overload, disrupt or attempt to gain unauthorised access to
          the Service, and not to use it for any unlawful purpose.
        </p>
      </LegalSection>

      <LegalSection heading="Limitation of liability">
        <p>
          To the fullest extent permitted by law, My Football Tracker shall not be liable for any
          indirect, incidental or consequential damages, or any loss arising from your use of, or
          reliance on, the Service or its content.
        </p>
      </LegalSection>

      <LegalSection heading="Changes">
        <p>
          We may modify or discontinue the Service, or update these Terms, at any time. Continued use
          after changes take effect constitutes acceptance of the updated Terms.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about these Terms? Email{" "}
          <a href="mailto:hello@myfootballtracker.com">hello@myfootballtracker.com</a>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
