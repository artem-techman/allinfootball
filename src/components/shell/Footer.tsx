import Link from "next/link";
import { BallMark } from "@/components/primitives/BallMark";

const AD_CONTACT = "mailto:ads@myfootballtracker.com?subject=Advertising%20on%20My%20Football%20Tracker";

/** Primary in-app links (kept in sync with the sidebar nav). */
const EXPLORE = [
  { label: "Matches", href: "/matches" },
  { label: "Competitions", href: "/competition/world-cup/table" },
  { label: "News", href: "/news" },
  { label: "Highlights", href: "/feed" },
];

const LEGAL = [
  { label: "About", href: "/about" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];

/**
 * Site footer — brand, primary links, legal pages, data attribution and the
 * copyright line. Rendered once at the bottom of the app shell so it appears on
 * every page.
 */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-10 border-t border-hairline pt-8 text-text-secondary">
      <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
        <div className="max-w-sm">
          <Link href="/" aria-label="My Football Tracker home" className="inline-flex items-center gap-2.5 text-text-primary">
            <BallMark className="h-8 w-8 shrink-0" />
            <span className="text-cardtitle font-bold">My Football Tracker</span>
          </Link>
          <p className="mt-3 text-meta leading-relaxed">
            Live scores, tables, lineups and stats across the world&apos;s biggest competitions —
            the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, the Champions League,
            Europa League, MLS and the FIFA World Cup.
          </p>
        </div>

        <nav className="flex gap-12" aria-label="Footer">
          <div>
            <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-text-muted">Explore</h3>
            <ul className="space-y-2 text-meta">
              {EXPLORE.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-text-muted">Company</h3>
            <ul className="space-y-2 text-meta">
              {LEGAL.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <a href={AD_CONTACT} className="hover:text-text-primary">
                  Advertise
                </a>
              </li>
            </ul>
          </div>
        </nav>
      </div>

      <div className="mt-8 flex flex-col gap-2 border-t border-hairline pt-5 text-[12px] text-text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>© {year} My Football Tracker. All rights reserved.</p>
        <p>
          Football data provided by API-Football. News headlines link to their original sources.
        </p>
      </div>
    </footer>
  );
}
