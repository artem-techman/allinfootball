"use client";

export type CalendarFilter = "all" | "live" | "finished" | "favorites";

const TABS: { value: CalendarFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "finished", label: "Finished" },
  { value: "favorites", label: "Favorites" },
];

/** Filter tabs for the calendar (CLAUDE.md section 8). */
export function FilterTabs({
  value,
  onChange,
  liveCount = 0,
}: {
  value: CalendarFilter;
  onChange: (v: CalendarFilter) => void;
  liveCount?: number;
}) {
  return (
    <div role="tablist" aria-label="Match filter" className="flex items-center gap-1 rounded-full border border-hairline bg-card p-1">
      {TABS.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-meta font-semibold transition-colors ${
              active ? "bg-accent-gradient text-text-on-accent" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
            {t.value === "live" && liveCount > 0 && (
              <span
                className={`grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] ${
                  active ? "bg-black/15 text-text-on-accent" : "bg-live-red text-text-on-dark"
                }`}
              >
                {liveCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
