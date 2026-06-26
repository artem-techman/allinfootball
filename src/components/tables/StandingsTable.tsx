import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import type { Standing } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";
import { FormPill } from "@/components/primitives/Pill";
import { EmptyState } from "@/components/primitives/EmptyState";
import { entitySlug } from "@/lib/utils/slug";

/**
 * Standings table (CLAUDE.md sections 8 + 9): Pos, Club, Pld, W, D, L, GF, GA,
 * GD, Pts, Form. Linear by default; when rows carry groupLabels (e.g. World Cup)
 * it renders a header per group. Rows in `highlightTeamIds` are tinted (used by
 * the match-center Table tab). The full World Cup group/third-place view lands
 * in M3.
 */
export function StandingsTable({
  rows,
  highlightTeamIds = [],
  showForm = true,
}: {
  rows: Standing[];
  highlightTeamIds?: number[];
  showForm?: boolean;
}) {
  if (rows.length === 0) {
    return <EmptyState title="Standings not available for this stage" hint="Knockout rounds don't use a league table." />;
  }

  const groups = new Map<string | null, Standing[]>();
  for (const r of rows) {
    const arr = groups.get(r.groupLabel) ?? [];
    arr.push(r);
    groups.set(r.groupLabel, arr);
  }
  const grouped = groups.size > 1;
  // All groups share ONE table so every column lines up across groups; each
  // group label becomes a full-width banner row spanning all columns.
  const colCount = 10 + (showForm ? 1 : 0);

  return (
    <div className="overflow-hidden rounded-card border border-hairline bg-card">
      <table className="w-full text-meta">
        <thead>
          <tr className="border-b border-hairline text-[11px] uppercase text-text-muted">
            <th className="py-2 pl-4 text-left font-medium">#</th>
            <th className="py-2 text-left font-medium">Club</th>
            <Th>Pld</Th>
            <Th>W</Th>
            <Th>D</Th>
            <Th>L</Th>
            <Th>GF</Th>
            <Th>GA</Th>
            <Th>GD</Th>
            <Th>Pts</Th>
            {showForm && <th className="py-2 pr-4 text-right font-medium">Form</th>}
          </tr>
        </thead>
        <tbody>
          {[...groups.entries()].map(([label, groupRows]) => (
            <Fragment key={label ?? "all"}>
              {grouped && (
                <tr>
                  <td
                    colSpan={colCount}
                    className="border-b border-hairline bg-card-2 px-4 py-2 text-meta font-semibold text-text-primary"
                  >
                    {label}
                  </td>
                </tr>
              )}
              {[...groupRows]
                .sort((a, b) => a.position - b.position)
                .map((r) => {
                  const hl = highlightTeamIds.includes(r.teamId);
                  return (
                    <tr key={r.teamId} className={`border-b border-hairline last:border-0 ${hl ? "bg-accent-lime-soft" : ""}`}>
                      <td className="tabular py-2 pl-4 text-text-secondary">{r.position}</td>
                      <td className="py-2">
                        <Link
                          href={`/team/${r.team ? entitySlug(r.team.name, r.team.id) : r.teamId}`}
                          className="flex items-center gap-2 hover:underline"
                        >
                          <Crest src={r.team?.crest} name={r.team?.name ?? "Team"} size={18} />
                          <span className="truncate text-text-primary">{r.team?.name}</span>
                        </Link>
                      </td>
                      <Td>{r.played}</Td>
                      <Td>{r.won}</Td>
                      <Td>{r.drawn}</Td>
                      <Td>{r.lost}</Td>
                      <Td>{r.gf}</Td>
                      <Td>{r.ga}</Td>
                      <Td>{r.gd > 0 ? `+${r.gd}` : r.gd}</Td>
                      <td className="tabular py-2 text-center font-bold text-text-primary">{r.points}</td>
                      {showForm && (
                        <td className="py-2 pr-4">
                          <span className="flex justify-end gap-1">
                            {r.form.slice(-5).map((f, i) => (
                              <FormPill key={i} result={f} />
                            ))}
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="tabular px-1.5 py-2 text-center font-medium">{children}</th>;
}
function Td({ children }: { children: ReactNode }) {
  return <td className="tabular px-1.5 py-2 text-center text-text-secondary">{children}</td>;
}
