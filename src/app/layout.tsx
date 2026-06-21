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
 * goodfootballcompany.com custom domain is connected. The brand is "Good Football
 * Company" everywhere.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://goodfootballcompany.com"),
  title: {
    default: "Good Football Company — Live scores, tables & match stats",
    template: "%s · Good Football Company",
  },
  description:
    "Good Football Company tracks the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Europa League, MLS and the FIFA World Cup — live scores, tables, lineups and stats.",
  applicationName: "Good Football Company",
  openGraph: {
    siteName: "Good Football Company",
    type: "website",
    url: "https://goodfootballcompany.com",
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
