import type { Lineup, LineupPlayer, Team } from "@/lib/providers/types";
import { pitchName } from "./pitchName";

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

/** Label room per player, in pitch units (a 5-across row leaves ~11.3 between centres). */
const LABEL_MAX_W = 11;
const LABEL_FONT = 2.2;
const LABEL_MIN_FONT = 1.7;
/** Rough average glyph width of the UI sans, as a fraction of the font size. */
const GLYPH_EM = 0.56;

/**
 * Fit a surname under its node without cutting it (B33 — "Mittelstäd"): shrink
 * the font down to LABEL_MIN_FONT, then squeeze with textLength as a last resort.
 */
function labelFit(label: string): { fontSize: number; textLength?: number } {
  const widthAt = (fs: number) => label.length * GLYPH_EM * fs;
  if (widthAt(LABEL_FONT) <= LABEL_MAX_W) return { fontSize: LABEL_FONT };
  const fontSize = Math.max(LABEL_MIN_FONT, LABEL_MAX_W / (label.length * GLYPH_EM));
  return widthAt(fontSize) <= LABEL_MAX_W ? { fontSize } : { fontSize, textLength: LABEL_MAX_W };
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
  const label = pitchName(player.name);
  const fit = labelFit(label);
  return (
    <g>
      <circle cx={x} cy={y} r={2.8} fill="var(--surface-dark-2)" stroke={ring} strokeWidth={0.5} />
      <text x={x} y={y + 1} textAnchor="middle" fontSize={2.6} fill="var(--text-on-dark)" fontWeight="700">
        {player.number ?? ""}
      </text>
      <text
        x={x}
        y={y + 6}
        textAnchor="middle"
        fontSize={fit.fontSize}
        textLength={fit.textLength}
        lengthAdjust={fit.textLength ? "spacingAndGlyphs" : undefined}
        fill="var(--text-on-dark-dim)"
      >
        <title>{player.name}</title>
        {label}
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
