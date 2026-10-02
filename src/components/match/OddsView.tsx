import type { Match, Odds } from "@/lib/providers/types";
import { EmptyState } from "@/components/primitives/EmptyState";
import { impliedSplit } from "./impliedOdds";

/**
 * Odds tab — NEUTRAL DATA ONLY (CLAUDE.md sections 8 + 17; B16/N6). Shows the
 * pre-match market's view of the match as implied probabilities (Home / Draw /
 * Away, margin removed, median across price lists). No bookmaker is named, no
 * prices are compared, nothing links out: no betting CTAs, affiliate links or
 * gambling promotion. Pre-match prices say nothing about a game in progress, so
 * once a match has started the tab only explains that they're hidden.
 */

const STARTED: Match["status"][] = ["live", "ht", "finished", "abandoned", "suspended"];

export function OddsView({ odds, match }: { odds?: Odds; match: Match }) {
  if (STARTED.includes(match.status)) {
    return <EmptyState title="Pre-match odds are hidden once a match starts." />;
  }
  const split = impliedSplit(odds?.books ?? []);
  if (!split) return <EmptyState title="Odds not available for this match" />;

  const segments = [
    { key: "home", label: match.homeTeam?.name ?? "Home", pct: split.home, bar: "bg-accent-lime" },
    { key: "draw", label: "Draw", pct: split.draw, bar: "bg-surface-dark-2" },
    { key: "away", label: match.awayTeam?.name ?? "Away", pct: split.away, bar: "bg-accent-electric" },
  ];

  return (
    <section className="rounded-card border border-hairline bg-card p-card">
      <h3 className="mb-3 text-cardtitle text-text-primary">Pre-match market view</h3>

      {/* three-segment bar; the numbers below carry the same data for screen readers */}
      <div aria-hidden className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
        {segments.map((s) => (
          <span key={s.key} className={`h-full ${s.bar}`} style={{ width: `${s.pct}%` }} />
        ))}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-3">
        {segments.map((s, i) => (
          <div key={s.key} className={i === 0 ? "text-left" : i === 1 ? "text-center" : "text-right"}>
            <dt className="truncate text-[11px] text-text-secondary">{s.label}</dt>
            <dd className="tabular mt-0.5 text-section font-bold text-text-primary">{s.pct}%</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-[11px] text-text-muted">
        Implied probabilities from pre-match 1X2 prices, margin removed. Shown for information only —
        My Football Tracker does not offer betting.
      </p>
    </section>
  );
}
