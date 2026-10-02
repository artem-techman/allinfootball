"use client";

import { Fragment, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Standing } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";
import { FormPill } from "@/components/primitives/Pill";
import { EmptyState } from "@/components/primitives/EmptyState";
import { entitySlug } from "@/lib/utils/slug";
import { focusGroupRows, groupStandings } from "./standingsGroups";

/**
 * Standings table (CLAUDE.md sections 8 + 9): Pos, Club, Pld, W, D, L, GF, GA,
 * GD, Pts, Form. Linear by default; when rows carry groupLabels (e.g. World Cup)
 * it renders a header per group. Rows in `highlightTeamIds` are tinted (used by
 * the match-center Table tab).
 *
 * Under 640px (B7) only # | Club | P | GD | Pts | Form (last 3) show, the club
 * name truncates, and # + Club stay pinned if the table ever has to scroll
 * sideways — Pts stays on screen at 375px without a horizontal page scroll.
 *
 * `focusTeamIds` (B15) opens a grouped table on just the group(s) holding those
 * teams, with a "Show all groups" toggle.
 */
export function StandingsTable({
  rows,
  highlightTeamIds = [],
  focusTeamIds = [],
  showForm = true,
}: {
  rows: Standing[];
  highlightTeamIds?: number[];
  focusTeamIds?: number[];
  showForm?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);

  if (rows.length === 0) {
    return <EmptyState title="Standings not available for this stage" hint="Knockout rounds don't use a league table." />;
  }

  const focused = focusGroupRows(rows, focusTeamIds);
  const visible = focused && !showAll ? focused : rows;
  const groups = groupStandings(visible);
  const grouped = groupStandings(rows).size > 1;
  // All groups share ONE table so every column lines up across groups; each
  // group label becomes a full-width banner row spanning all columns.
  const colCount = 10 + (showForm ? 1 : 0);

  return (
    <div>
      {focused && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            className="text-meta font-semibold text-text-secondary transition-colors hover:text-text-primary"
          >
            {showAll ? (groupStandings(focused).size > 1 ? "Show these groups only" : "Show this group only") : "Show all groups"}
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-card border border-hairline bg-card">
        <table className="w-full text-meta">
          <thead>
            <tr className="border-b border-hairline text-[11px] uppercase text-text-muted">
              <th className={`${PIN_POS} bg-card py-2 pl-4 text-left font-medium`}>#</th>
              <th className={`${PIN_CLUB} bg-card py-2 text-left font-medium`}>Club</th>
              <Th>
                <abbr title="Played" className="no-underline">
                  <span className="sm:hidden">P</span>
                  <span className="hidden sm:inline">Pld</span>
                </abbr>
              </Th>
              <Th wide>W</Th>
              <Th wide>D</Th>
              <Th wide>L</Th>
              <Th wide>GF</Th>
              <Th wide>GA</Th>
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
                    // Pinned cells are opaque; repaint the row tint on top of them.
                    const pinBg = hl ? `bg-card ${HL_OVERLAY}` : "bg-card";
                    const form = r.form.slice(-5);
                    return (
                      <tr key={r.teamId} className={`border-b border-hairline last:border-0 ${hl ? "bg-accent-lime-soft" : ""}`}>
                        <td className={`${PIN_POS} ${pinBg} tabular py-2 pl-4 text-text-secondary`}>{r.position}</td>
                        <td className={`${PIN_CLUB} ${pinBg} max-w-0 py-2 pr-2`}>
                          <Link
                            href={`/team/${r.team ? entitySlug(r.team.name, r.team.id) : r.teamId}`}
                            className="flex min-w-0 items-center gap-2 hover:underline"
                          >
                            <span className="shrink-0">
                              <Crest src={r.team?.crest} name={r.team?.name ?? "Team"} size={18} />
                            </span>
                            <span className="min-w-0 truncate text-text-primary">{r.team?.name}</span>
                          </Link>
                        </td>
                        <Td>{r.played}</Td>
                        <Td wide>{r.won}</Td>
                        <Td wide>{r.drawn}</Td>
                        <Td wide>{r.lost}</Td>
                        <Td wide>{r.gf}</Td>
                        <Td wide>{r.ga}</Td>
                        <Td>{r.gd > 0 ? `+${r.gd}` : r.gd}</Td>
                        <td className="tabular px-1.5 py-2 text-center font-bold text-text-primary">{r.points}</td>
                        {showForm && (
                          <td className="py-2 pr-4">
                            <span className="flex justify-end gap-1">
                              {form.map((f, i) => (
                                // Phones show the last three results only.
                                <span key={i} className={i < form.length - 3 ? "hidden sm:block" : undefined}>
                                  <FormPill result={f} />
                                </span>
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
    </div>
  );
}

/** # and Club stay put if the table scrolls sideways (# is a fixed 40px so Club can sit right after it). */
const PIN_POS = "sticky left-0 z-[1] w-10 min-w-10";
const PIN_CLUB = "sticky left-10 z-[1] w-full";
/** The highlight tint, as an image layer so it can sit over an opaque pinned cell. */
const HL_OVERLAY = "bg-[linear-gradient(var(--accent-lime-soft),var(--accent-lime-soft))]";

/** `wide` columns (W, D, L, GF, GA) only show from 640px up. */
function Th({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <th className={`tabular px-1.5 py-2 text-center font-medium ${wide ? "hidden sm:table-cell" : ""}`}>{children}</th>
  );
}
function Td({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <td className={`tabular px-1.5 py-2 text-center text-text-secondary ${wide ? "hidden sm:table-cell" : ""}`}>
      {children}
    </td>
  );
}
