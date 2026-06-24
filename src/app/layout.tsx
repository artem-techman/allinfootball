import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Root metadata (CLAUDE.md section 13). metadataBase + og:site_name already
 * point at the production domain so canonical URLs are correct. The brand is
 * "My Football Tracker" everywhere.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://myfootballtracker.com"),
  title: {
    default: "My Football Tracker — Live scores, tables & match stats",
    template: "%s · My Football Tracker",
  },
  description:
    "My Football Tracker tracks the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Europa League, MLS and the FIFA World Cup — live scores, tables, lineups and stats.",
  applicationName: "My Football Tracker",
  openGraph: {
    siteName: "My Football Tracker",
    type: "website",
    url: "https://myfootballtracker.com",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {/* Apply the saved theme before paint to avoid a flash (dark is default). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('allinfootball.theme')==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}})();`,
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
    </html>
  );
}
