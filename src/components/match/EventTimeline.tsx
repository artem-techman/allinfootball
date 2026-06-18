import type { Match, MatchEvent, MatchEventType } from "@/lib/providers/types";
import { EmptyState } from "@/components/primitives/EmptyState";

/**
 * Summary tab — event timeline (CLAUDE.md section 8). Goals, cards, subs and VAR
 * checks down a central spine, home events on the left, away on the right.
 */

const GLYPH: Partial<Record<MatchEventType, string>> = {
  goal: "⚽",
  penalty: "⚽",
  own_goal: "⚽",
  missed_penalty: "✖",
  yellow: "▮",
  red: "▮",
  sub: "⇄",
  var: "VAR",
};

function label(e: MatchEvent): string {
  switch (e.type) {
    case "penalty":
      return "Goal (penalty)";
    case "own_goal":
      return "Own goal";
    case "missed_penalty":
      return "Penalty missed";
    case "yellow":
      return "Yellow card";
    case "red":
      return "Red card";
    case "sub":
      return "Substitution";
    case "var":
      return e.detail ?? "VAR";
    default:
      return "Goal";
  }
}

function glyphClass(t: MatchEventType): string {
  if (t === "yellow") return "text-star";
  if (t === "red" || t === "own_goal" || t === "missed_penalty") return "text-live-red";
  if (t === "goal" || t === "penalty") return "text-accent-lime";
  return "text-text-secondary";
}

const SHOWN: MatchEventType[] = ["goal", "penalty", "own_goal", "missed_penalty", "yellow", "red", "sub", "var"];

export function EventTimeline({ events, match }: { events: MatchEvent[]; match: Match }) {
  const shown = events
    .filter((e) => SHOWN.includes(e.type))
    .sort((a, b) => a.minute + (a.extraMinute ?? 0) / 100 - (b.minute + (b.extraMinute ?? 0) / 100));

  if (shown.length === 0) {
    return <EmptyState title="No key events yet" hint="Goals, cards and subs will appear here." />;
  }

  return (
    <div className="rounded-card border border-hairline bg-card p-card">
      <ul className="space-y-1">
        {shown.map((e) => {
          const isHome = e.teamId === match.homeTeamId;
          return (
            <li key={e.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className={isHome ? "text-right" : ""}>
                {isHome && <EventBody e={e} align="right" />}
              </div>
              <div className="tabular grid h-7 min-w-9 place-items-center rounded-full bg-white/5 px-2 text-meta font-semibold text-text-secondary">
                {e.minute}&rsquo;{e.extraMinute ? `+${e.extraMinute}` : ""}
              </div>
              <div>{!isHome && <EventBody e={e} align="left" />}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EventBody({ e, align }: { e: MatchEvent; align: "left" | "right" }) {
  const inner = (
    <>
      <span className={`text-[13px] ${glyphClass(e.type)}`} aria-hidden>
        {GLYPH[e.type]}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-body font-medium text-text-primary">
          {e.playerName ?? label(e)}
        </span>
        <span className="block text-[11px] text-text-muted">
          {label(e)}
          {e.type === "sub" && e.relatedPlayerName ? ` · ${e.relatedPlayerName} off` : ""}
          {(e.type === "goal" || e.type === "penalty") && e.relatedPlayerName ? ` · assist ${e.relatedPlayerName}` : ""}
        </span>
      </span>
    </>
  );
  return (
    <span className={`inline-flex items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      {inner}
    </span>
  );
}
