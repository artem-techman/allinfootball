"use client";

import { useEffect, useRef, useState } from "react";
import type { Match } from "@/lib/providers/types";
import { liveMinuteLabel } from "@/lib/utils/match";
import { tickMinute } from "./liveClock";

/** How often the label re-checks the clock (cheap: one span re-renders). */
const TICK_MS = 5_000;

/**
 * The live minute, advancing between polls so it doesn't read as "stuck" (N7).
 * Hydration-safe: the server and first client render show the provider's
 * minute; ticking starts after mount, from the moment this reading arrived.
 * Each new provider reading (minute / extraMinute / status) re-anchors the clock.
 */
export function useTickingMinute(m: Pick<Match, "status" | "minute" | "extraMinute">) {
  const { status, minute, extraMinute } = m;
  const key = `${status}|${minute ?? ""}|${extraMinute ?? ""}`;
  const [clock, setClock] = useState<{ key: string; at: number; now: number; floor: number } | null>(null);
  // Minute last put on screen: the floor for the next reading, so the display
  // never steps back when the provider confirms a minute we'd already reached.
  const shown = useRef<number | undefined>(undefined);

  useEffect(() => {
    const k = `${status}|${minute ?? ""}|${extraMinute ?? ""}`;
    const at = Date.now();
    setClock({ key: k, at, now: at, floor: shown.current ?? 0 });
    if (status !== "live" || minute == null || extraMinute) return; // frozen: HT, FT, stoppage, "LIVE"
    const id = setInterval(() => {
      setClock((c) => (c && c.key === k ? { ...c, now: Date.now() } : c));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [status, minute, extraMinute]);

  let value: Pick<Match, "minute" | "extraMinute"> = { minute, extraMinute };
  if (clock) {
    // A new reading renders once before its effect re-anchors: hold the floor, add no time.
    const current = clock.key === key;
    value = tickMinute(m, current ? clock.now - clock.at : 0, current ? clock.floor : (shown.current ?? 0));
  }

  useEffect(() => {
    shown.current = value.minute;
  });

  return value;
}

/** Ticking live-minute label ("67'", "90+3'", "LIVE"). Styling stays with the caller. */
export function LiveMinute({ match, className }: { match: Pick<Match, "status" | "minute" | "extraMinute">; className?: string }) {
  const value = useTickingMinute(match);
  return <span className={className}>{liveMinuteLabel(value)}</span>;
}
