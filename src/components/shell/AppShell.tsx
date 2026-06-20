import type { ReactNode } from "react";
import Link from "next/link";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { BallMark } from "@/components/primitives/BallMark";

/**
 * 3-column responsive shell (CLAUDE.md section 12). Sidebar 240px fixed, main
 * fluid (max ~880px, 28px gutters), right rail 340px fixed, 24px column gap.
 * Responsive: at <=1200px the rail drops below main; at <=820px the sidebar
 * collapses to a top bar (handled here with a simple mobile header) and content
 * stacks single-column. Mobile-first.
 *
 * `rail` is optional so pages without a right rail (match center, etc.) reuse
 * the same shell.
 */
export function AppShell({
  children,
  rail,
  wide = false,
}: {
  children: ReactNode;
  rail?: ReactNode;
  /** Drop the ~880px main cap (for wide tables: standings, squads). */
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen bg-page">
      {/* mobile top bar (sidebar collapses below 820px) */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-hairline bg-card px-4 py-3 min-[821px]:hidden">
        <Link href="/" aria-label="Good Football Company home" className="inline-flex items-center gap-2 text-text-primary">
          <BallMark className="h-8 w-8 shrink-0" />
          <span className="text-cardtitle font-bold">Good Football Company</span>
        </Link>
        <MobileNav />
      </div>

      <div className="mx-auto flex max-w-[1440px] gap-6 px-0 min-[821px]:px-6">
        {/* fixed sidebar, hidden on mobile */}
        <div className="sticky top-0 hidden h-screen shrink-0 min-[821px]:block">
          <Sidebar />
        </div>

        {/* main + rail */}
        <div className="flex min-w-0 flex-1 flex-col gap-6 py-6 min-[1201px]:flex-row min-[1201px]:items-start">
          <main className={`min-w-0 flex-1 px-4 min-[821px]:px-7 ${wide ? "" : "min-[1201px]:max-w-main"}`}>
            {children}
          </main>
          {rail && (
            <div className="w-full shrink-0 space-y-5 px-4 min-[821px]:px-7 min-[1201px]:w-rail min-[1201px]:px-0">
              {rail}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
