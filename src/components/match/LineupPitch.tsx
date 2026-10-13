import type { KitColors, Lineup, LineupPlayer, Match, MatchEvent } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";
import { pitchName } from "./pitchName";

/**
 * Formation pitch, premium edition. Both XIs on one pitch, built from fixed-size
 * HTML nodes over a drawn pitch — so markers stay small and crisp at any width
 * (the old SVG scaled its circles and text with the column: ~1,300px tall,
 * oversized dots). Landscape on wider screens (home left → attacking right),
 * portrait on phones. Discs wear the team's real kit colours when the provider
 * sends them; small badges mark goals, cards and the minute a player went off.
 */

type Side = "home" | "away";

interface Node {
  p: LineupPlayer;
  side: Side;
  /** 0..1 along the pitch length from the HOME goal, and across (0 = home team's left). */
  along: number;
  across: number;
  keeper: boolean;
}

export function hasGrid(l: Lineup): boolean {
  return l.starters.length > 0 && l.starters.every((p) => p.gridRow != null && p.gridCol != null);
}

/** Grid rows → depth in the team's own half; columns spread evenly across. */
function place(l: Lineup, side: Side): Node[] {
  const maxRow = Math.max(...l.starters.map((p) => p.gridRow ?? 1));
  const byRow = new Map<number, LineupPlayer[]>();
  for (const p of l.starters) (byRow.get(p.gridRow ?? 1) ?? byRow.set(p.gridRow ?? 1, []).get(p.gridRow ?? 1)!).push(p);
  const out: Node[] = [];
  for (const [row, players] of byRow) {
    const ordered = [...players].sort((a, b) => (a.gridCol ?? 0) - (b.gridCol ?? 0));
    const depth = maxRow > 1 ? (row - 1) / (maxRow - 1) : 0; // 0 = own goal line … 1 = most advanced
    ordered.forEach((p, i) => {
      const across = (i + 1) / (ordered.length + 1);
      const along = 0.06 + depth * 0.38; // keep each XI in its own half
      out.push({
        p,
        side,
        keeper: row === 1,
        along: side === "home" ? along : 1 - along,
        across: side === "home" ? across : 1 - across,
      });
    });
  }
  return out;
}

const FALLBACK: Record<Side, KitColors> = {
  home: { primary: "#5bc850", number: "#08110a", border: "#cdf24a" },
  away: { primary: "#f2f4f7", number: "#111317", border: "#ffffff" },
};
const KEEPER_FALLBACK: KitColors = { primary: "#2b2f36", number: "#ffffff", border: "#8b929c" };

interface Badges {
  goals: number;
  ownGoals: number;
  yellow: boolean;
  red: boolean;
  offAt?: string;
}

function badgesFor(events: MatchEvent[]): Map<number, Badges> {
  const map = new Map<number, Badges>();
  const get = (id: number) => map.get(id) ?? map.set(id, { goals: 0, ownGoals: 0, yellow: false, red: false }).get(id)!;
  for (const e of events) {
    const min = `${e.minute}${e.extraMinute ? `+${e.extraMinute}` : ""}'`;
    if ((e.type === "goal" || e.type === "penalty") && e.playerId) get(e.playerId).goals += 1;
    if (e.type === "own_goal" && e.playerId) get(e.playerId).ownGoals += 1;
    if (e.type === "yellow" && e.playerId) get(e.playerId).yellow = true;
    if (e.type === "red" && e.playerId) get(e.playerId).red = true;
    if (e.type === "sub" && e.relatedPlayerId) get(e.relatedPlayerId).offAt = min; // relatedPlayer = went off
  }
  return map;
}

export function LineupPitch({ home, away, match, events }: { home: Lineup; away: Lineup; match: Match; events: MatchEvent[] }) {
  if (!hasGrid(home) || !hasGrid(away)) return null;
  const nodes = [...place(home, "home"), ...place(away, "away")];
  const badges = badgesFor(events);
  const kit = (side: Side, keeper: boolean) => {
    const l = side === "home" ? home : away;
    return keeper ? (l.keeperKit ?? KEEPER_FALLBACK) : (l.kit ?? FALLBACK[side]);
  };

  return (
    <section className="overflow-hidden rounded-card border border-hairline bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <TeamTag lineup={home} team={match.homeTeam} align="left" />
        <TeamTag lineup={away} team={match.awayTeam} align="right" />
      </header>

      {/* landscape (≥640px): home attacks left → right */}
      <div className="hidden p-3 sm:block">
        <Pitch orientation="landscape">
          {nodes.map((n) => (
            <PlayerNode
              key={`${n.side}-${n.p.playerId}`}
              node={n}
              kit={kit(n.side, n.keeper)}
              badges={badges.get(n.p.playerId)}
              // attacking right, a player's left side is the top of the pitch
              style={{ left: `${n.along * 100}%`, top: `${n.across * 100}%` }}
            />
          ))}
        </Pitch>
      </div>

      {/* portrait (phones): home at the bottom attacking up */}
      <div className="p-3 sm:hidden">
        <Pitch orientation="portrait">
          {nodes.map((n) => (
            <PlayerNode
              key={`${n.side}-${n.p.playerId}`}
              node={n}
              kit={kit(n.side, n.keeper)}
              badges={badges.get(n.p.playerId)}
              style={{ left: `${n.across * 100}%`, top: `${(1 - n.along) * 100}%` }}
            />
          ))}
        </Pitch>
      </div>
    </section>
  );
}

function TeamTag({ lineup, team, align }: { lineup: Lineup; team?: Match["homeTeam"]; align: "left" | "right" }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <Crest src={team?.crest} name={team?.name ?? ""} size={22} />
      <span className="truncate text-meta font-semibold text-text-primary">{team?.name}</span>
      {lineup.formation && (
        <span className="tabular shrink-0 rounded-full bg-card-2 px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
          {lineup.formation}
        </span>
      )}
    </div>
  );
}

/** The pitch surface: mown stripes + fine markings, at a true pitch aspect ratio. */
function Pitch({ orientation, children }: { orientation: "landscape" | "portrait"; children: React.ReactNode }) {
  const landscape = orientation === "landscape";
  const stripes = landscape
    ? "repeating-linear-gradient(90deg, rgba(255,255,255,0.028) 0 9.09%, transparent 9.09% 18.18%)"
    : "repeating-linear-gradient(0deg, rgba(255,255,255,0.028) 0 9.09%, transparent 9.09% 18.18%)";
  return (
    <div
      className={`relative w-full overflow-hidden rounded-[14px] ${landscape ? "aspect-[105/68]" : "mx-auto aspect-[68/105] max-w-[420px]"}`}
      style={{
        backgroundColor: "#123821",
        backgroundImage: `${stripes}, radial-gradient(120% 90% at 50% 50%, #1a4a2b 0%, #0f2e1a 70%, #0b2414 100%)`,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 60px rgba(0,0,0,0.35)",
      }}
    >
      <PitchLines landscape={landscape} />
      {children}
    </div>
  );
}

function PitchLines({ landscape }: { landscape: boolean }) {
  // Drawn in a 105×68 (or 68×105) box matching the container's aspect ratio, so
  // circles stay round. Thin, low-contrast lines: the players are the focus.
  const W = landscape ? 105 : 68;
  const H = landscape ? 68 : 105;
  const line = { fill: "none", stroke: "rgba(255,255,255,0.22)", strokeWidth: 0.35 } as const;
  const box = (x: number, y: number, w: number, h: number) =>
    landscape ? <rect x={x} y={y} width={w} height={h} {...line} /> : <rect x={y} y={x} width={h} height={w} {...line} />;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
      <rect x={1.5} y={1.5} width={W - 3} height={H - 3} rx={0.8} {...line} />
      {landscape ? <line x1={W / 2} y1={1.5} x2={W / 2} y2={H - 1.5} {...line} /> : <line x1={1.5} y1={H / 2} x2={W - 1.5} y2={H / 2} {...line} />}
      <circle cx={W / 2} cy={H / 2} r={9.15} {...line} />
      <circle cx={W / 2} cy={H / 2} r={0.5} fill="rgba(255,255,255,0.35)" />
      {/* penalty areas + goal areas, both ends (length coords, then width coords) */}
      {box(1.5, (68 - 40.3) / 2, 16.5, 40.3)}
      {box(105 - 1.5 - 16.5, (68 - 40.3) / 2, 16.5, 40.3)}
      {box(1.5, (68 - 18.3) / 2, 5.5, 18.3)}
      {box(105 - 1.5 - 5.5, (68 - 18.3) / 2, 5.5, 18.3)}
    </svg>
  );
}

function PlayerNode({
  node,
  kit,
  badges,
  style,
}: {
  node: Node;
  kit: KitColors;
  badges?: Badges;
  style: React.CSSProperties;
}) {
  const { p } = node;
  const name = pitchName(p.name);
  return (
    <div className="absolute flex w-[76px] -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={style} title={p.name}>
      <div className="relative">
        <span
          className="tabular grid h-[30px] w-[30px] place-items-center rounded-full text-[12px] font-bold shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
          style={{ background: kit.primary, color: kit.number, boxShadow: `inset 0 0 0 1.5px ${kit.border}, 0 2px 6px rgba(0,0,0,0.45)` }}
        >
          {p.number ?? ""}
        </span>
        {badges?.goals ? (
          <span className="absolute -right-2 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-white px-[3px] text-[9px] font-bold leading-none text-[#0b0c0e] shadow">
            ⚽{badges.goals > 1 ? <span className="ml-px">{badges.goals}</span> : null}
          </span>
        ) : null}
        {badges?.red ? (
          <span className="absolute -left-1.5 -top-1 h-[11px] w-[8px] rounded-[2px] bg-[#ef4444] shadow" aria-label="Sent off" />
        ) : badges?.yellow ? (
          <span className="absolute -left-1.5 -top-1 h-[11px] w-[8px] rounded-[2px] bg-[#facc15] shadow" aria-label="Booked" />
        ) : null}
        {badges?.offAt && (
          <span className="tabular absolute -bottom-1.5 -right-3 rounded-full bg-black/70 px-1 text-[9px] font-semibold leading-[13px] text-[#fca5a5]">
            ↓{badges.offAt}
          </span>
        )}
      </div>
      <span className="mt-1 max-w-full truncate px-0.5 text-[11px] font-medium leading-tight text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
        {name}
      </span>
    </div>
  );
}
