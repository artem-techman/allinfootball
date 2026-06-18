"use client";

import Link from "next/link";
import { shiftDateKey, todayKey } from "@/lib/utils/date";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/primitives/icons";

/**
 * Horizontal date strip for the match calendar (CLAUDE.md section 8). Shows a
 * 7-day window centred on the selected date, with prev/next stepping a week and
 * a "Today" shortcut. Each day links to /matches/[date]; the selected day is a
 * lime pill, today is marked.
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
  const today = todayKey();
  const days = Array.from({ length: 7 }, (_, i) => shiftDateKey(selected, i - 3));

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/matches/${shiftDateKey(selected, -7)}`}
        aria-label="Previous week"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-tile border border-hairline text-text-secondary transition-colors hover:text-text-primary"
      >
        <ChevronLeftIcon size={18} />
      </Link>

      <div className="flex flex-1 items-stretch gap-2 overflow-x-auto">
        {days.map((dk) => {
          const { weekday, day, month } = dayParts(dk);
          const isSelected = dk === selected;
          const isToday = dk === today;
          return (
            <Link
              key={dk}
              href={`/matches/${dk}`}
              aria-current={isSelected ? "date" : undefined}
              className={`flex min-w-[64px] flex-1 flex-col items-center justify-center rounded-tile border px-2 py-2 transition-colors ${
                isSelected
                  ? "border-accent-lime bg-accent-lime text-text-on-accent"
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

      <Link
        href={`/matches/${shiftDateKey(selected, 7)}`}
        aria-label="Next week"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-tile border border-hairline text-text-secondary transition-colors hover:text-text-primary"
      >
        <ChevronRightIcon size={18} />
      </Link>
    </div>
  );
}
