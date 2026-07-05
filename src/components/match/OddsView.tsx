import type { BookmakerOdds, Match, Odds } from "@/lib/providers/types";
import { EmptyState } from "@/components/primitives/EmptyState";

/**
 * Odds tab — NEUTRAL DATA ONLY (CLAUDE.md sections 8 + 17). A 1X2 comparison
 * across the biggest European bookmakers: best price per outcome summarised on
 * top and highlighted in the table, so visitors can see who offers the best
 * odds. Purely informational; no betting CTAs, affiliate links or gambling
 * promotion.
 */

type OutcomeKey = "home" | "draw" | "away";

export function OddsView({ odds, match }: { odds?: Odds; match: Match }) {
  const books = odds?.books ?? [];
  if (books.length === 0) {
    return <EmptyState title="Odds not available for this match" />;
  }

  const outcomes: { key: OutcomeKey; label: string }[] = [
    { key: "home", label: match.homeTeam?.name ?? "Home" },
    { key: "draw", label: "Draw" },
    { key: "away", label: match.awayTeam?.name ?? "Away" },
  ];

  // Highest decimal price per outcome = the best deal for the punter.
  const best: Record<OutcomeKey, number | undefined> = { home: undefined, draw: undefined, away: undefined };
  for (const o of outcomes) {
    const prices = books.map((b) => b[o.key]).filter((v): v is number => v != null);
    best[o.key] = prices.length ? Math.max(...prices) : undefined;
  }
  const bestBook = (key: OutcomeKey): BookmakerOdds | undefined =>
    best[key] == null ? undefined : books.find((b) => b[key] === best[key]);

  return (
    <section className="rounded-card border border-hairline bg-card p-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-cardtitle text-text-primary">Match odds (1X2)</h3>
        <span className="shrink-0 text-[11px] text-text-muted">
          {books.length} bookmaker{books.length > 1 ? "s" : ""} compared
        </span>
      </div>

      {/* Best price per outcome */}
      <div className="grid grid-cols-3 gap-3">
        {outcomes.map((o) => (
          <div key={o.key} className="rounded-tile border border-[rgba(91,200,80,0.35)] bg-card-2 p-3 text-center">
            <div className="truncate text-[11px] text-text-secondary">{o.label}</div>
            <div className="tabular mt-1 text-section font-bold text-accent-lime">
              {best[o.key] != null ? best[o.key]!.toFixed(2) : "-"}
            </div>
            <div className="mt-0.5 truncate text-[10px] text-text-muted">
              {bestBook(o.key) ? `best · ${bestBook(o.key)!.name}` : " "}
            </div>
          </div>
        ))}
      </div>

      {/* Per-bookmaker comparison, best price per column highlighted */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-left">
          <thead>
            <tr className="border-b border-hairline text-[11px] uppercase tracking-wide text-text-muted">
              <th className="py-2 pr-3 font-semibold">Bookmaker</th>
              {outcomes.map((o) => (
                <th key={o.key} className="px-3 py-2 text-right font-semibold">
                  <span className="block max-w-[110px] truncate">{o.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {books.map((b) => (
              <tr key={b.name}>
                <td className="py-2.5 pr-3 text-meta font-semibold text-text-primary">{b.name}</td>
                {outcomes.map((o) => {
                  const v = b[o.key];
                  const isBest = v != null && v === best[o.key];
                  return (
                    <td key={o.key} className="px-3 py-2.5 text-right">
                      <span
                        className={`tabular inline-block min-w-[52px] rounded-md px-2 py-1 text-meta ${
                          isBest
                            ? "bg-accent-lime-soft font-bold text-accent-lime"
                            : "text-text-primary"
                        }`}
                      >
                        {v != null ? v.toFixed(2) : "-"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-text-muted">
        Decimal odds, best price per outcome highlighted. Shown for information only — My Football
        Tracker does not offer betting.
      </p>
    </section>
  );
}
