"use client";

import { useState } from "react";
import Link from "next/link";
import type { Standing } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";
import { Skeleton } from "@/components/primitives/Skeleton";
import { ChevronDownIcon } from "@/components/primitives/icons";
import { COMPETITIONS, type CompetitionConst } from "@/lib/constants/competitions";

const LEAGUE_LOGO = (id: number) => `https://media.api-sports.io/football/leagues/${id}.png`;

/**
 * Top Table rail (#6) with a competition picker. Starts on the competition the
 * server pre-rendered (Premier League by default); switching fetches that
 * competition's standings client-side and shows the top 5. Cup competitions show
 * group rows, or "Table not available" once they reach knockouts.
 */
export function TopTableRail({
  initialSlug,
  initialRows,
}: {
  initialSlug: string;
  initialRows: Standing[];
}) {
  const [slug, setSlug] = useState(initialSlug);
  const [rows, setRows] = useState<Standing[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const comp = COMPETITIONS.find((c) => c.slug === slug) ?? COMPETITIONS[0];

  async function select(c: CompetitionConst) {
    setPickerOpen(false);
    if (c.slug === slug) return;
    setSlug(c.slug);
    setLoading(true);
    try {
      const res = await fetch(`/api/standings?league=${c.leagueId}&season=${c.defaultSeason}`, { cache: "no-store" });
      const data = (await res.json()) as { standings?: Standing[] };
      setRows(data.standings ?? []);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }

  return (
    <section className="relative overflow-hidden rounded-card border border-hairline bg-card p-card">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 right-0 h-28 w-40 rounded-full bg-accent-lime-soft blur-2xl"
      />
      <header className="relative mb-3">
        <h3 className="text-cardtitle text-text-primary">Top Table</h3>
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          aria-expanded={pickerOpen}
          className="mt-1 flex items-center gap-1.5 rounded-full border border-hairline bg-card-2 px-2.5 py-1 text-meta text-text-secondary transition-colors hover:text-text-primary"
        >
          <Crest src={LEAGUE_LOGO(comp.leagueId)} name={comp.name} size={15} />
          <span className="font-semibold">{comp.name}</span>
          <ChevronDownIcon size={14} />
        </button>

        {pickerOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} aria-hidden />
            <div className="absolute left-0 top-full z-20 mt-1 max-h-72 w-60 overflow-y-auto rounded-tile border border-hairline bg-card shadow-elevated">
              {COMPETITIONS.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => select(c)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-meta transition-colors hover:bg-white/5 ${
                    c.slug === slug ? "text-text-primary" : "text-text-secondary"
                  }`}
                >
                  <Crest src={LEAGUE_LOGO(c.leagueId)} name={c.name} size={16} />
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </header>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-3 text-center text-meta text-text-secondary">Table not available</p>
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
              <tr key={`${r.groupLabel ?? ""}-${r.teamId}`} className="border-t border-hairline">
                <td className="tabular py-1.5 text-text-secondary">{r.position}</td>
                <td className="py-1.5">
                  <span className="flex items-center gap-2">
                    <Crest src={r.team?.crest} name={r.team?.name ?? "Team"} size={16} />
                    <span className="truncate text-text-primary">{r.team?.shortName ?? r.team?.name}</span>
                  </span>
                </td>
                <td className="tabular py-1.5 text-right text-text-secondary">{r.played}</td>
                <td className="tabular py-1.5 text-right text-text-secondary">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                <td className="tabular py-1.5 text-right font-bold text-text-primary">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Link
        href={`/competition/${slug}/table`}
        className="relative mt-3 block border-t border-hairline pt-3 text-center text-meta font-semibold text-text-primary hover:text-accent-lime"
      >
        View full table
      </Link>
    </section>
  );
}
