import Link from "next/link";
import type { Standing } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";
import { Skeleton } from "@/components/primitives/Skeleton";

/**
 * Top Table rail (CLAUDE.md section 12): competition badge (Premier League by
 * default), compact Pos / Team / Pld / GD / Pts for the top 5, "View full
 * table" link. Renders a skeleton when rows are null (loading) and an empty note
 * when standings don't apply.
 */
export function TopTableRail({
  competitionName,
  competitionSlug,
  competitionLogo,
  rows,
}: {
  competitionName: string;
  competitionSlug: string;
  competitionLogo?: string;
  rows: Standing[] | null;
}) {
  return (
    <section className="relative overflow-hidden rounded-card border border-hairline bg-card p-card">
      {/* lime glow accent (reference) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 right-0 h-28 w-40 rounded-full bg-accent-lime-soft blur-2xl"
      />
      <header className="relative mb-3">
        <h3 className="text-cardtitle text-text-primary">Top Table</h3>
        <div className="mt-1 flex items-center gap-1.5">
          <Crest src={competitionLogo} name={competitionName} size={15} />
          <span className="text-meta text-text-secondary">{competitionName}</span>
        </div>
      </header>

      {rows === null ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-3 text-center text-meta text-text-secondary">
          Table not available
        </p>
      ) : (
        <table className="relative w-full text-meta">
          <thead>
            <tr className="text-[11px] uppercase text-text-secondary">
              <th className="py-1 text-left font-medium">Pos</th>
              <th className="py-1 text-left font-medium">Team</th>
              <th className="tabular py-1 text-right font-medium">P</th>
              <th className="tabular py-1 text-right font-medium">GD</th>
              <th className="tabular py-1 text-right font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 5).map((r) => (
              <tr key={r.teamId} className="border-t border-hairline">
                <td className="tabular py-1.5 text-text-secondary">{r.position}</td>
                <td className="py-1.5">
                  <span className="flex items-center gap-2">
                    <Crest src={r.team?.crest} name={r.team?.name ?? "Team"} size={16} />
                    <span className="truncate text-text-primary">{r.team?.shortName ?? r.team?.name}</span>
                  </span>
                </td>
                <td className="tabular py-1.5 text-right text-text-secondary">{r.played}</td>
                <td className="tabular py-1.5 text-right text-text-secondary">
                  {r.gd > 0 ? `+${r.gd}` : r.gd}
                </td>
                <td className="tabular py-1.5 text-right font-bold text-text-primary">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Link
        href={`/competition/${competitionSlug}/table`}
        className="relative mt-3 block border-t border-hairline pt-3 text-center text-meta font-semibold text-text-primary hover:text-accent-lime"
      >
        View full table
      </Link>
    </section>
  );
}
