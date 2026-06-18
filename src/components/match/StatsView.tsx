import type { MatchStats } from "@/lib/providers/types";
import { StatComparisonBar } from "./StatComparisonBar";
import { EmptyState } from "@/components/primitives/EmptyState";

/**
 * Stats tab (CLAUDE.md section 8). Comparison bars for shots, possession, pass
 * accuracy, etc. The xG/xGOT block self-hides when neither side has the data
 * (section 10). Shows the pre-kickoff empty state when no stats exist yet.
 */
export function StatsView({
  home,
  away,
}: {
  home?: MatchStats;
  away?: MatchStats;
}) {
  if (!home && !away) {
    return <EmptyState title="Stats available once the match begins" />;
  }

  const rows: { label: string; h?: number; a?: number; suffix?: string }[] = [
    { label: "Possession", h: home?.possession, a: away?.possession, suffix: "%" },
    { label: "Total shots", h: home?.shots, a: away?.shots },
    { label: "Shots on target", h: home?.sot, a: away?.sot },
    { label: "Shots inside box", h: home?.shotsInBox, a: away?.shotsInBox },
    { label: "Shots outside box", h: home?.shotsOutBox, a: away?.shotsOutBox },
    { label: "Blocked shots", h: home?.blocked, a: away?.blocked },
    { label: "Passes", h: home?.passes, a: away?.passes },
    { label: "Pass accuracy", h: home?.passAccuracy, a: away?.passAccuracy, suffix: "%" },
    { label: "Saves", h: home?.saves, a: away?.saves },
    { label: "Corners", h: home?.corners, a: away?.corners },
    { label: "Fouls", h: home?.fouls, a: away?.fouls },
    { label: "Offsides", h: home?.offsides, a: away?.offsides },
    { label: "Yellow cards", h: home?.yellow, a: away?.yellow },
    { label: "Red cards", h: home?.red, a: away?.red },
  ];

  const xgRows: { label: string; h?: number; a?: number }[] = [
    { label: "Expected goals (xG)", h: home?.xg, a: away?.xg },
    { label: "Goals prevented (xGOT)", h: home?.xgot, a: away?.xgot },
  ];
  const showXg = xgRows.some((r) => r.h != null || r.a != null);

  return (
    <div className="rounded-card border border-hairline bg-card p-card">
      <div className="divide-y divide-hairline">
        {rows.map((r) => (
          <StatComparisonBar key={r.label} label={r.label} home={r.h} away={r.a} suffix={r.suffix} />
        ))}
      </div>

      {showXg && (
        <div className="mt-3 border-t border-hairline pt-2">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Advanced</p>
          <div className="divide-y divide-hairline">
            {xgRows.map((r) => (
              <StatComparisonBar key={r.label} label={r.label} home={r.h} away={r.a} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
