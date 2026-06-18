import type { Lineup, LineupPlayer, Team } from "@/lib/providers/types";

/**
 * Formation pitch (CLAUDE.md section 9): both starting XIs on one SVG pitch —
 * home in the bottom half, away mirrored in the top half — positioned from the
 * provider grid (row:col). Returns null when grid data is missing so LineupsView
 * can fall back to a plain list. Colours come from tokens; players use surname
 * + shirt number.
 */
const PITCH_W = 68;
const PITCH_H = 100;

function hasGrid(l: Lineup): boolean {
  return l.starters.length > 0 && l.starters.every((p) => p.gridRow != null && p.gridCol != null);
}

function surname(name: string): string {
  const parts = name.split(" ");
  return parts[parts.length - 1];
}

function positions(starters: LineupPlayer[], side: "home" | "away") {
  const maxRow = Math.max(...starters.map((p) => p.gridRow ?? 1));
  const byRow = new Map<number, LineupPlayer[]>();
  for (const p of starters) {
    const r = p.gridRow ?? 1;
    const arr = byRow.get(r) ?? [];
    arr.push(p);
    byRow.set(r, arr);
  }
  const out: { p: LineupPlayer; x: number; y: number }[] = [];
  for (const [row, players] of byRow) {
    const ordered = [...players].sort((a, b) => (a.gridCol ?? 0) - (b.gridCol ?? 0));
    ordered.forEach((p, i) => {
      const frac = maxRow > 1 ? (row - 1) / (maxRow - 1) : 0;
      const y = side === "home" ? PITCH_H - 4 - frac * 44 : 4 + frac * 44;
      let x = ((i + 1) / (ordered.length + 1)) * PITCH_W;
      if (side === "away") x = PITCH_W - x;
      out.push({ p, x, y });
    });
  }
  return out;
}

function Node({ x, y, player, side }: { x: number; y: number; player: LineupPlayer; side: "home" | "away" }) {
  const ring = side === "home" ? "var(--accent-lime)" : "var(--accent-electric)";
  return (
    <g>
      <circle cx={x} cy={y} r={2.8} fill="var(--surface-dark-2)" stroke={ring} strokeWidth={0.5} />
      <text x={x} y={y + 1} textAnchor="middle" fontSize={2.6} fill="var(--text-on-dark)" fontWeight="700">
        {player.number ?? ""}
      </text>
      <text x={x} y={y + 6} textAnchor="middle" fontSize={2.2} fill="var(--text-on-dark-dim)">
        {surname(player.name).slice(0, 10)}
      </text>
    </g>
  );
}

export function FormationPitch({
  home,
  away,
}: {
  home: Lineup;
  away: Lineup;
  homeTeam?: Team;
  awayTeam?: Team;
}) {
  if (!hasGrid(home) || !hasGrid(away)) return null;

  const nodes = [
    ...positions(home.starters, "home").map((n) => ({ ...n, side: "home" as const })),
    ...positions(away.starters, "away").map((n) => ({ ...n, side: "away" as const })),
  ];

  return (
    <div className="overflow-hidden rounded-card border border-hairline bg-surface-dark p-3">
      <svg viewBox={`0 0 ${PITCH_W} ${PITCH_H}`} className="w-full" role="img" aria-label="Formation pitch">
        {/* pitch markings */}
        <rect x={1} y={1} width={PITCH_W - 2} height={PITCH_H - 2} fill="none" stroke="var(--border-hairline)" strokeWidth={0.4} rx={1} />
        <line x1={1} y1={PITCH_H / 2} x2={PITCH_W - 1} y2={PITCH_H / 2} stroke="var(--border-hairline)" strokeWidth={0.4} />
        <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r={7} fill="none" stroke="var(--border-hairline)" strokeWidth={0.4} />
        <rect x={PITCH_W / 2 - 11} y={1} width={22} height={13} fill="none" stroke="var(--border-hairline)" strokeWidth={0.4} />
        <rect x={PITCH_W / 2 - 11} y={PITCH_H - 14} width={22} height={13} fill="none" stroke="var(--border-hairline)" strokeWidth={0.4} />
        {nodes.map(({ p, x, y, side }) => (
          <Node key={`${side}-${p.playerId}`} x={x} y={y} player={p} side={side} />
        ))}
      </svg>
    </div>
  );
}
