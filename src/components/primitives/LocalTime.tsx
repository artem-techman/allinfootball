"use client";

import { useEffect, useState } from "react";
import { formatKickoffTime, formatShortDate, formatLongDate } from "@/lib/utils/date";

type Mode = "time" | "date" | "long";

/**
 * Renders a UTC ISO timestamp in the USER'S local timezone. Kickoffs are stored
 * in UTC; the browser knows the viewer's timezone, so times adapt automatically
 * (a match at 19:00 UTC shows 8:00 PM in London, 2:00 PM in New York, etc.).
 *
 * To avoid a hydration mismatch, the server and the first client render both use
 * UTC (deterministic); after mount we switch to the resolved local timezone. The
 * swap is a sub-second, one-time update on load.
 */
export function LocalTime({ iso, mode = "time" }: { iso: string; mode?: Mode }) {
  const [tz, setTz] = useState("UTC");

  useEffect(() => {
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    } catch {
      setTz("UTC");
    }
  }, []);

  let text: string;
  if (mode === "time") text = formatKickoffTime(iso, tz);
  else if (mode === "long") text = formatLongDate(iso.slice(0, 10));
  else text = formatShortDate(iso, tz);

  return <time dateTime={iso}>{text}</time>;
}
