"use client";

import { useState } from "react";
import type { Match } from "@/lib/providers/types";
import { UpcomingMatchCard } from "./UpcomingMatchCard";

/** How many cards to show on mobile/tablet before "See more". */
const MOBILE_LIMIT = 4;

/**
 * Upcoming matches container. On desktop (≥1024px) it's a horizontal carousel
 * showing every fixture (scroll with the trackpad). On mobile/tablet it's a
 * stacked grid capped at {@link MOBILE_LIMIT} fixtures, with a "See more" button
 * to reveal the rest. The cap only applies to the grid layout — the desktop
 * carousel always shows all cards regardless of the expanded state.
 */
export function UpcomingMatches({ matches }: { matches: Match[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = matches.length > MOBILE_LIMIT;

  return (
    <>
      {/* Mobile/tablet: stacked grid. Desktop (≥1024px): a horizontal
          carousel scrollable with the trackpad (two-finger swipe). */}
      <div className="grid gap-4 sm:grid-cols-2 lg:flex lg:snap-x lg:snap-proximity lg:gap-4 lg:overflow-x-auto lg:overscroll-x-contain lg:pb-2 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {matches.map((m, i) => (
          <div
            key={m.id}
            className={`lg:block lg:w-[260px] lg:flex-shrink-0 lg:snap-start ${
              !expanded && i >= MOBILE_LIMIT ? "hidden" : ""
            }`}
          >
            <UpcomingMatchCard match={m} />
          </div>
        ))}
      </div>

      {hasMore && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-4 w-full rounded-card border border-hairline bg-card py-3 text-meta font-semibold text-text-primary transition-colors hover:bg-card-2 lg:hidden"
        >
          See more matches
        </button>
      )}
    </>
  );
}
