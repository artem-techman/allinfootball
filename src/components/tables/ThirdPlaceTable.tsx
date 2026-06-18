import type { Standing } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";

/**
 * Third-place ranking (CLAUDE.md sections 8 + 10) for the World Cup group stage:
 * the third-placed team from each group, ranked by points, goal difference then
 * goals for — the basis for which third-placed teams advance. Renders nothing
 * when the data isn't grouped (so callers can omit it for leagues/knockouts).
 */
export function ThirdPlaceTable({ rows }: { rows: Standing[] }) {
  const groups = new Set(rows.map((r) => r.groupLabel).filter(Boolean));
  if (groups.size < 2) return null;

  const thirds = rows
    .filter((r) => r.position === 3)
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);

  if (thirds.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-card border border-hairline bg-card">
      <div className="border-b border-hairline bg-card-2 px-4 py-2 text-meta font-semibold text-text-primary">
        Third-placed teams
      </div>
      <table className="w-full text-meta">
        <thead>
          <tr className="border-b border-hairline text-[11px] uppercase text-text-muted">
            <th className="py-2 pl-4 text-left font-medium">#</th>
            <th className="py-2 text-left font-medium">Team</th>
            <th className="py-2 text-left font-medium">Group</th>
            <th className="px-2 py-2 text-center font-medium">Pld</th>
            <th className="px-2 py-2 text-center font-medium">GD</th>
            <th className="px-3 py-2 text-center font-medium">Pts</th>
          </tr>
        </thead>
        <tbody>
          {thirds.map((r, i) => (
            <tr key={`${r.groupLabel}-${r.teamId}`} className="border-b border-hairline last:border-0">
              <td className="tabular py-2 pl-4 text-text-secondary">{i + 1}</td>
              <td className="py-2">
                <span className="flex items-center gap-2">
                  <Crest src={r.team?.crest} name={r.team?.name ?? "Team"} size={18} />
                  <span className="truncate text-text-primary">{r.team?.name}</span>
                </span>
              </td>
              <td className="py-2 text-text-secondary">{r.groupLabel}</td>
              <td className="tabular px-2 py-2 text-center text-text-secondary">{r.played}</td>
              <td className="tabular px-2 py-2 text-center text-text-secondary">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
              <td className="tabular px-3 py-2 text-center font-bold text-text-primary">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
