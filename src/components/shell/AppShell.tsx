import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { PageTransition } from "./PageTransition";
import { Logo } from "@/components/primitives/Logo";

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
  below,
  wide = false,
}: {
  children: ReactNode;
  rail?: ReactNode;
  /** Full-width content rendered below the main+rail row (spans both columns). */
  below?: ReactNode;
  /** Drop the ~880px main cap (for wide tables: standings, squads). */
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen bg-page">
      {/* mobile top bar (sidebar collapses below 820px) */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-hairline bg-card px-4 py-3 min-[821px]:hidden">
        <Logo />
        <MobileNav />
      </div>

      <div className="mx-auto flex max-w-[1440px] gap-6 px-0 min-[821px]:px-6">
        {/* fixed sidebar, hidden on mobile */}
        <div data-app-sidebar className="sticky top-0 hidden h-screen shrink-0 min-[821px]:block">
          <Sidebar />
        </div>

        {/* content column: the main+rail row, then any full-width `below` */}
        <div className="flex min-w-0 flex-1 flex-col gap-6 py-6">
          <div className="flex flex-col gap-6 min-[1201px]:flex-row min-[1201px]:items-start">
            <main className={`min-w-0 flex-1 px-4 min-[821px]:px-7 ${wide ? "" : "min-[1201px]:max-w-main"}`}>
              <PageTransition>{children}</PageTransition>
            </main>
            {rail && (
              <div className="w-full shrink-0 space-y-5 px-4 min-[821px]:px-7 min-[1201px]:w-rail min-[1201px]:px-0">
                {rail}
              </div>
            )}
          </div>
          {below && <div className="px-4 min-[821px]:px-7">{below}</div>}
        </div>
      </div>
    </div>
  );
}
