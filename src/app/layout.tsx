import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { JsonLd, organization, website } from "@/components/seo/JsonLd";
import { buildMetadata, SITE_NAME, SITE_URL } from "@/lib/seo/metadata";
import { competitionListSentence } from "@/lib/seo/copy";
import { COMPETITIONS } from "@/lib/constants/competitions";
import "@/styles/globals.css";

// GA4 Measurement ID (G-XXXXXXXXXX). Set NEXT_PUBLIC_GA_ID in the environment
// to enable analytics; left unset, no tracking script is loaded.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const DEFAULT_TITLE = "My Football Tracker — Live scores, tables & match stats";
const SHARE_DESCRIPTION =
  "Live football scores, tables, fixtures, lineups and stats across the world's biggest competitions.";

/**
 * Root metadata (CLAUDE.md section 13). metadataBase + og:site_name point at the
 * production domain. Routes override title/description/canonical/openGraph via
 * buildMetadata() (src/lib/seo/metadata.ts); this root openGraph is the home
 * page's share card. No canonical here — a root canonical would be inherited by
 * every page that lacks its own (404s included) and point them all at home.
 */
const rootShare = buildMetadata({
  title: DEFAULT_TITLE,
  description: SHARE_DESCRIPTION,
  path: "/",
  absoluteTitle: true,
  // The root segment's own opengraph-image.tsx supplies og:image.
  image: "file",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: `${SITE_NAME} tracks ${competitionListSentence()} — live scores, tables, lineups and stats.`,
  applicationName: SITE_NAME,
  keywords: [
    "football", "soccer", "live scores", "football scores", "league tables",
    "fixtures", "results", ...COMPETITIONS.map((c) => c.name),
  ],
  category: "sports",
  openGraph: rootShare.openGraph,
  twitter: rootShare.twitter,
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        {/* Site-wide publisher + website identity for search engines. */}
        <JsonLd data={organization()} />
        <JsonLd data={website()} />
        {/* Apply the saved sidebar state before paint to avoid a flash
            (expanded is the default). The platform is night-mode only. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{document.documentElement.setAttribute('data-sidebar',localStorage.getItem('allinfootball.sidebar.collapsed')==='1'?'collapsed':'expanded');}catch(e){}})();`,
          }}
        />
        {/* Shared brand-gradient def for the BallMark logo. Defined ONCE here (and
            always rendered, never display:none) so every mark references a single
            valid id — Chrome won't paint a gradient defined inside a hidden subtree,
            which is what duplicate per-instance defs caused. */}
        <svg width="0" height="0" aria-hidden focusable="false" style={{ position: "absolute" }}>
          <defs>
            <linearGradient id="mftBrandGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#23a455" />
              <stop offset="50%" stopColor="#5bc850" />
              <stop offset="100%" stopColor="#d9ff3f" />
            </linearGradient>
          </defs>
        </svg>
        {children}
      </body>
      {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
    </html>
  );
}
