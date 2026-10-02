"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { shiftDateKey, todayKey } from "@/lib/utils/date";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/primitives/icons";

/**
 * Horizontal date strip for the match calendar (CLAUDE.md section 8). Shows a
 * 7-day window centred on the selected date, with prev/next stepping a week
 * (a day on phones, where the strip scrolls — B22) and a "Today" shortcut. Each
 * day links to /matches/[date]; the selected day is a lime pill, today is
 * marked, and the selected pill is scrolled into view on mount so it's never
 * clipped on a narrow screen.
 */
function dayParts(dateKey: string) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" }).format(d),
    day: new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric" }).format(d),
    month: new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short" }).format(d),
  };
}

export function DateStrip({ selected }: { selected: string }) {
  // "Today" in the viewer's local timezone (UTC baseline until mount to avoid a
  // hydration mismatch).
  const [today, setToday] = useState(() => todayKey("UTC"));
  useEffect(() => {
    try {
      setToday(todayKey(Intl.DateTimeFormat().resolvedOptions().timeZone));
    } catch {
      setToday(todayKey());
    }
  }, []);
  const days = Array.from({ length: 7 }, (_, i) => shiftDateKey(selected, i - 3));

  // Centre the selected day inside the strip (a no-op when every day fits).
  const selectedRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    try {
      selectedRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
    } catch {
      /* browsers without scrollIntoView options: leave the strip as is */
    }
  }, [selected]);

  return (
    <div className="flex items-center gap-2">
      <StepLink selected={selected} days={-1} label="Previous day" className="grid sm:hidden">
        <ChevronLeftIcon size={18} />
      </StepLink>
      <StepLink selected={selected} days={-7} label="Previous week" className="hidden sm:grid">
        <ChevronLeftIcon size={18} />
      </StepLink>

      <div className="flex flex-1 items-stretch gap-2 overflow-x-auto">
        {days.map((dk) => {
          const { weekday, day, month } = dayParts(dk);
          const isSelected = dk === selected;
          const isToday = dk === today;
          return (
            <Link
              key={dk}
              ref={isSelected ? selectedRef : undefined}
              href={`/matches/${dk}`}
              aria-current={isSelected ? "date" : undefined}
              className={`flex min-w-[64px] flex-1 flex-col items-center justify-center rounded-tile border px-2 py-2 transition-colors ${
                isSelected
                  ? "border-accent-lime bg-accent-gradient text-text-on-accent"
                  : "border-hairline bg-card text-text-secondary hover:border-white/15 hover:text-text-primary"
              }`}
            >
              <span className="text-[11px] uppercase tracking-wide">{weekday}</span>
              <span className="tabular text-cardtitle font-bold leading-tight">{day}</span>
              <span className={`text-[10px] ${isToday && !isSelected ? "text-accent-lime" : "opacity-70"}`}>
                {isToday ? "Today" : month}
              </span>
            </Link>
          );
        })}
      </div>

      <StepLink selected={selected} days={1} label="Next day" className="grid sm:hidden">
        <ChevronRightIcon size={18} />
      </StepLink>
      <StepLink selected={selected} days={7} label="Next week" className="hidden sm:grid">
        <ChevronRightIcon size={18} />
      </StepLink>
    </div>
  );
}

/** Prev/next arrow. Phones step a day, wider screens a week; both render and CSS picks one (hydration-safe). */
function StepLink({
  selected,
  days,
  label,
  className,
  children,
}: {
  selected: string;
  days: number;
  label: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={`/matches/${shiftDateKey(selected, days)}`}
      aria-label={label}
      className={`${className} h-10 w-10 shrink-0 place-items-center rounded-tile border border-hairline text-text-secondary transition-colors hover:text-text-primary`}
    >
      {children}
    </Link>
  );
}
