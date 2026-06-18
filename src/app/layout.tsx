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
 * point at the production domain so canonical URLs are correct before the
 * allinfootball.com custom domain is connected. The brand is "All In Football"
 * everywhere.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://allinfootball.com"),
  title: {
    default: "All In Football — Live scores, tables & match stats",
    template: "%s · All In Football",
  },
  description:
    "All In Football tracks the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Europa League, MLS and the FIFA World Cup — live scores, tables, lineups and stats.",
  applicationName: "All In Football",
  openGraph: {
    siteName: "All In Football",
    type: "website",
    url: "https://allinfootball.com",
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
        {children}
      </body>
    </html>
  );
}
