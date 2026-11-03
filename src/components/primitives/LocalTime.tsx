"use client";

import { useEffect, useState } from "react";
import { formatKickoffTime, formatShortDate, formatLongDate } from "@/lib/utils/date";

type Mode = "time" | "date" | "long";

/** Shown until the viewer's timezone is known: neutral, never a wrong time. */
const TIME_PLACEHOLDER = "--:--";
/** Blank (keeps the line height) rather than a date that may be a day off. */
const DATE_PLACEHOLDER = " ";

/**
 * Renders a UTC ISO timestamp in the USER'S local timezone. Kickoffs are stored
 * in UTC; the browser knows the viewer's timezone, so times adapt automatically
 * (a match at 19:00 UTC shows 8:00 PM in London, 2:00 PM in New York, etc.).
 *
 * The server can't know the viewer's timezone, so the server and the first
 * client render show a neutral placeholder (B33: they used to show the UTC time,
 * e.g. 6:45 PM for an 8:45 PM CEST kickoff, until hydration) and the real local
 * value appears right after mount. "long" mode is timezone-free and renders
 * straight away. The ISO stays in `dateTime`, and the server HTML also carries
 * the UK time as hidden text for readers that never run JavaScript.
 */
export function LocalTime({ iso, mode = "time" }: { iso: string; mode?: Mode }) {
  const [tz, setTz] = useState<string | null>(null);

  useEffect(() => {
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    } catch {
      setTz("UTC");
    }
  }, []);

  if (mode === "long") return <time dateTime={iso}>{formatLongDate(iso.slice(0, 10))}</time>;
  if (tz == null) {
    // Before the timezone is known: a neutral placeholder on screen, and the UK
    // time as hidden text, so AI assistants and other readers that don't run
    // JavaScript still get a real kick-off time (they saw only "--:--").
    const uk = mode === "time" ? `${formatKickoffTime(iso, "Europe/London")} UK time` : formatShortDate(iso, "Europe/London");
    return (
      <time dateTime={iso}>
        <span aria-hidden>{mode === "time" ? TIME_PLACEHOLDER : DATE_PLACEHOLDER}</span>
        <span className="sr-only">{uk}</span>
      </time>
    );
  }
  return <time dateTime={iso}>{mode === "time" ? formatKickoffTime(iso, tz) : formatShortDate(iso, tz)}</time>;
}
