"use client";

import { useEffect, useState } from "react";
import { todayKey, formatLongDate } from "@/lib/utils/date";
import { SearchAutocomplete } from "./SearchAutocomplete";

/**
 * Home header (desktop): today's date (in the viewer's local timezone) + a
 * subtitle on the left, and the search on the right. The whole text block is
 * hidden on mobile (AppShell handles that); the search stays. Intentionally
 * minimal — no personal name, account menu or notifications for now.
 *
 * Hydration: server and first client render both use the default timezone, then
 * we switch to the resolved local timezone after mount (a one-time update).
 */
export function GreetingHeader() {
  const [today, setToday] = useState(() => formatLongDate(todayKey()));

  useEffect(() => {
    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      tz = undefined;
    }
    setToday(formatLongDate(todayKey(tz)));
  }, []);

  return (
    <header className="mb-6 flex flex-wrap items-center gap-4">
      <div className="hidden min-w-0 min-[821px]:block">
        <h1 className="text-greeting text-text-primary" suppressHydrationWarning>
          {today}
        </h1>
        <p className="mt-1 text-meta text-text-secondary">
          Here&apos;s what&apos;s happening in the world of football.
        </p>
      </div>

      <div className="flex flex-1 justify-end">
        <SearchAutocomplete />
      </div>
    </header>
  );
}
