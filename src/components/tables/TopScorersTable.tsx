"use client";

import { type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import type { TopScorer } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";
import { EmptyState } from "@/components/primitives/EmptyState";
import { entitySlug } from "@/lib/utils/slug";

type Metric = "goals" | "assists" | "ga";

interface Row {
  playerId: number;
  playerName: string;
  playerSlug: string;
  teamName?: string;
  teamCrest?: string;
  goals: number;
  assists: number;
}

const PLAYER_PHOTO = (id: number) => `https://media.api-sports.io/football/players/${id}.png`;

/**
 * Top scorers table (CLAUDE.md sections 8 + 9) with Goals / Assists /
 * Goals+Assists tabs. Merges the topscorers and topassists feeds so every tab
 * has a complete ranking; the active metric column is emphasised.
 */
export function TopScorersTable({
  scorers,
  assists,
}: {
  scorers: TopScorer[];
  assists: TopScorer[];
}) {
  const [metric, setMetric] = useState<Metric>("goals");

  const rows = useMemo<Row[]>(() => {
    const byId = new Map<number, Row>();
    for (const t of [...scorers, ...assists]) {
      if (!t.player) continue;
      const existing = byId.get(t.playerId);
      const row: Row = existing ?? {
        playerId: t.playerId,
        playerName: t.player.name,
        playerSlug: t.player.slug ?? entitySlug(t.player.name, t.playerId),
        teamName: t.team?.name,
        teamCrest: t.team?.crest,
        goals: 0,
        assists: 0,
      };
      row.goals = Math.max(row.goals, t.goals);
      row.assists = Math.max(row.assists, t.assists);
      byId.set(t.playerId, row);
    }
    return [...byId.values()];
  }, [scorers, assists]);

  const sorted = useMemo(() => {
    const val = (r: Row) => (metric === "goals" ? r.goals : metric === "assists" ? r.assists : r.goals + r.assists);
    return [...rows].sort((a, b) => val(b) - val(a)).slice(0, 25);
  }, [rows, metric]);

  if (rows.length === 0) {
    return <EmptyState title="Top scorers not available for this competition yet" />;
  }

  const tabs: { id: Metric; label: string }[] = [
    { id: "goals", label: "Goals" },
    { id: "assists", label: "Assists" },
    { id: "ga", label: "Goals + Assists" },
  ];

  return (
    <div className="space-y-4">
      <div role="tablist" className="inline-flex items-center gap-1 rounded-full border border-hairline bg-card p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={metric === t.id}
            onClick={() => setMetric(t.id)}
            className={`rounded-full px-3.5 py-1.5 text-meta font-semibold transition-colors ${
              metric === t.id ? "bg-accent-lime text-text-on-accent" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-card border border-hairline bg-card">
        <table className="w-full text-meta">
          <thead>
            <tr className="border-b border-hairline text-[11px] uppercase text-text-muted">
              <th className="py-2 pl-4 text-left font-medium">#</th>
              <th className="py-2 text-left font-medium">Player</th>
              <th className="py-2 text-left font-medium">Team</th>
              <Th active={metric === "goals"}>Goals</Th>
              <Th active={metric === "assists"}>Assists</Th>
              <Th active={metric === "ga"}>G+A</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.playerId} className="border-b border-hairline last:border-0">
                <td className="tabular py-2 pl-4 text-text-secondary">{i + 1}</td>
                <td className="py-2">
                  <Link href={`/player/${r.playerSlug}`} className="flex items-center gap-2 hover:underline">
                    <Crest src={PLAYER_PHOTO(r.playerId)} name={r.playerName} size={22} />
                    <span className="truncate text-text-primary">{r.playerName}</span>
                  </Link>
                </td>
                <td className="py-2">
                  <span className="flex items-center gap-1.5 text-text-secondary">
                    <Crest src={r.teamCrest} name={r.teamName ?? "Team"} size={16} />
                    <span className="truncate">{r.teamName}</span>
                  </span>
                </td>
                <Td active={metric === "goals"}>{r.goals}</Td>
                <Td active={metric === "assists"}>{r.assists}</Td>
                <Td active={metric === "ga"}>{r.goals + r.assists}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, active }: { children: ReactNode; active: boolean }) {
  return <th className={`px-3 py-2 text-right font-medium ${active ? "text-text-primary" : ""}`}>{children}</th>;
}
function Td({ children, active }: { children: ReactNode; active: boolean }) {
  return (
    <td className={`tabular px-3 py-2 text-right ${active ? "font-bold text-text-primary" : "text-text-secondary"}`}>
      {children}
    </td>
  );
}
