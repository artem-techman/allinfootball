"use client";

import { type ReactNode, useState } from "react";
import Link from "next/link";
import type { Match, Player, Standing, TeamProfile } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";
import { MatchCard } from "@/components/cards/MatchCard";
import { StandingsTable } from "@/components/tables/StandingsTable";
import { EmptyState } from "@/components/primitives/EmptyState";

type Tab = "overview" | "fixtures" | "results" | "squad" | "table";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "fixtures", label: "Fixtures" },
  { id: "results", label: "Results" },
  { id: "squad", label: "Squad" },
  { id: "table", label: "Table" },
];

const POS_ORDER = ["Goalkeeper", "Defender", "Midfielder", "Attacker"];

/** Team profile (CLAUDE.md section 8): header + Overview/Fixtures/Results/Squad/Table tabs. */
export function TeamProfileView({
  profile,
  recent,
  upcoming,
  squad,
  standings,
}: {
  profile: TeamProfile;
  recent: Match[];
  upcoming: Match[];
  squad: Player[];
  standings: Standing[];
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const { team } = profile;

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-4 rounded-card border border-hairline bg-card p-card">
        <Crest src={team.crest} name={team.name} size={64} />
        <div>
          <h1 className="text-greeting text-text-primary">{team.name}</h1>
          <p className="mt-0.5 text-meta text-text-secondary">
            {[profile.country, profile.founded ? `Founded ${profile.founded}` : null, profile.venue?.name]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-hairline">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-selected={tab === t.id}
            role="tab"
            className={`relative whitespace-nowrap px-3.5 py-2.5 text-meta font-semibold transition-colors ${
              tab === t.id ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
            {tab === t.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent-lime" />}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Next fixtures">
            <MatchList matches={upcoming.slice(0, 4)} empty="No upcoming fixtures" />
          </Panel>
          <Panel title="Recent results">
            <MatchList matches={recent.slice(0, 4)} empty="No recent results" />
          </Panel>
        </div>
      )}

      {tab === "fixtures" && (
        <Panel title="Upcoming">
          <MatchList matches={upcoming} empty="No upcoming fixtures" />
        </Panel>
      )}

      {tab === "results" && (
        <Panel title="Results">
          <MatchList matches={[...recent].reverse()} empty="No recent results" />
        </Panel>
      )}

      {tab === "squad" && <Squad squad={squad} />}

      {tab === "table" && <StandingsTable rows={standings} highlightTeamIds={[team.id]} />}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-hairline bg-card p-card">
      <h3 className="mb-2 text-cardtitle text-text-primary">{title}</h3>
      {children}
    </section>
  );
}

function MatchList({ matches, empty }: { matches: Match[]; empty: string }) {
  if (matches.length === 0) return <p className="py-3 text-center text-meta text-text-secondary">{empty}</p>;
  return (
    <ul className="divide-y divide-hairline">
      {matches.map((m) => (
        <li key={m.id}>
          <MatchCard match={m} />
        </li>
      ))}
    </ul>
  );
}

function Squad({ squad }: { squad: Player[] }) {
  if (squad.length === 0) return <EmptyState title="Squad not available" />;
  const groups = POS_ORDER.map((pos) => ({ pos, players: squad.filter((p) => p.position === pos) })).filter(
    (g) => g.players.length > 0,
  );
  const ungrouped = squad.filter((p) => !p.position || !POS_ORDER.includes(p.position));
  if (ungrouped.length) groups.push({ pos: "Other", players: ungrouped });

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.pos} className="rounded-card border border-hairline bg-card p-card">
          <h3 className="mb-2 text-cardtitle text-text-primary">{g.pos}</h3>
          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {g.players.map((p) => (
              <li key={p.id}>
                <Link href={`/player/${p.slug}`} className="flex items-center gap-2 py-1 text-body hover:underline">
                  <span className="tabular w-6 text-center text-meta text-text-muted">{p.number ?? "-"}</span>
                  <span className="truncate text-text-primary">{p.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
