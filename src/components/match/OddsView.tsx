import type { Match, Odds } from "@/lib/providers/types";
import { EmptyState } from "@/components/primitives/EmptyState";

/**
 * Odds tab — NEUTRAL DATA ONLY (CLAUDE.md sections 8 + 17). 1X2 decimal prices
 * for information; no betting CTAs, affiliate links or gambling promotion. The
 * implied-probability shading is purely informational.
 */
export function OddsView({ odds, match }: { odds?: Odds; match: Match }) {
  if (!odds || (odds.home == null && odds.draw == null && odds.away == null)) {
    return <EmptyState title="Odds not available for this match" />;
  }

  const cols: { label: string; value?: number }[] = [
    { label: match.homeTeam?.name ?? "Home", value: odds.home },
    { label: "Draw", value: odds.draw },
    { label: match.awayTeam?.name ?? "Away", value: odds.away },
  ];

  return (
    <section className="rounded-card border border-hairline bg-card p-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-cardtitle text-text-primary">Match odds (1X2)</h3>
        {odds.bookmaker && <span className="text-[11px] text-text-muted">via {odds.bookmaker}</span>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {cols.map((c) => (
          <div key={c.label} className="rounded-tile border border-hairline bg-card-2 p-3 text-center">
            <div className="truncate text-[11px] text-text-secondary">{c.label}</div>
            <div className="tabular mt-1 text-section font-bold text-text-primary">
              {c.value != null ? c.value.toFixed(2) : "-"}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-text-muted">
        Odds shown for information only. All In Football does not offer betting.
      </p>
    </section>
  );
}
