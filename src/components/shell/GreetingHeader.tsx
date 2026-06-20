"use client";

import { useEffect, useState } from "react";
import { greetingFor } from "@/lib/utils/date";
import { SearchAutocomplete } from "./SearchAutocomplete";

/**
 * Home header: a time-of-day greeting (in the viewer's local timezone) + a
 * subtitle on the left, and the search on the right. Intentionally minimal — no
 * personal name, account menu or notifications for now, to keep the dashboard
 * uncluttered.
 */
export function GreetingHeader() {
  const [greeting, setGreeting] = useState("Good evening");

  useEffect(() => {
    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      tz = undefined;
    }
    setGreeting(greetingFor(new Date(), tz));
  }, []);

  return (
    <header className="mb-6 flex flex-wrap items-center gap-4">
      <div className="hidden min-w-0 min-[821px]:block">
        <h1 className="flex items-center gap-2 text-greeting text-text-primary">
          {greeting}! <span aria-hidden>👋</span>
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
