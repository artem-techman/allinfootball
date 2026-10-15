"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { Match, Player, Standing, TeamProfile } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";
import { MatchCard } from "@/components/cards/MatchCard";
import { StandingsTable } from "@/components/tables/StandingsTable";
import { EmptyState } from "@/components/primitives/EmptyState";
import { LocalTime } from "@/components/primitives/LocalTime";

type Tab = "overview" | "fixtures" | "results" | "squad" | "table";
const pathFor = (slug: string, tab: Tab) => (tab === "overview" ? `/team/${slug}` : `/team/${slug}/${tab}`);

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "fixtures", label: "Fixtures" },
  { id: "results", label: "Results" },
  { id: "squad", label: "Squad" },
  { id: "table", label: "Table" },
];

const POS_ORDER = ["Goalkeeper", "Defender", "Midfielder", "Attacker"];

/**
 * Team profile (CLAUDE.md section 8): header + Overview/Fixtures/Results/Squad/
 * Table. Each tab is its own URL (/team/x/fixtures …) so every one can rank for
 * its own search ("arsenal fixtures", "arsenal squad").
 */
export function TeamProfileView({
  profile,
  slug,
  tab,
  recent,
  upcoming,
  squad,
  standings,
}: {
  profile: TeamProfile;
  slug: string;
  tab: Tab;
  recent: Match[];
  upcoming: Match[];
  squad: Player[];
  standings: Standing[];
}) {
  const { team } = profile;
  const label = TABS.find((t) => t.id === tab)?.label ?? "";
  // Results newest-first, fixtures soonest-first, whatever order the provider sent (B35).
  const results = [...recent].sort((a, b) => b.kickoffUtc.localeCompare(a.kickoffUtc));
  const fixtures = [...upcoming].sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-4 rounded-card border border-hairline bg-card p-card">
        <Crest src={team.crest} name={team.name} size={64} />
        <div>
          <h1 className="text-greeting text-text-primary">{tab === "overview" ? team.name : `${team.name} ${label.toLowerCase()}`}</h1>
          <p className="mt-0.5 text-meta text-text-secondary">
            {[profile.country, profile.founded ? `Founded ${profile.founded}` : null, profile.venue?.name]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-hairline">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={pathFor(slug, t.id)}
            scroll={false}
            aria-current={tab === t.id ? "page" : undefined}
            className={`relative whitespace-nowrap px-3.5 py-2.5 text-meta font-semibold transition-colors ${
              tab === t.id ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
            {tab === t.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent-gradient" />}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Next fixtures" more={fixtures.length > 4 ? { href: pathFor(slug, "fixtures"), label: "All fixtures" } : undefined}>
            <MatchList matches={fixtures.slice(0, 4)} empty="No upcoming fixtures" />
          </Panel>
          <Panel title="Recent results" more={results.length > 4 ? { href: pathFor(slug, "results"), label: "All results" } : undefined}>
            <MatchList matches={results.slice(0, 4)} empty="No recent results" />
          </Panel>
        </div>
      )}

      {tab === "fixtures" && (
        <Panel title="Upcoming">
          <MatchList matches={fixtures} empty="No upcoming fixtures" withMeta />
        </Panel>
      )}

      {tab === "results" && (
        <Panel title="Results">
          <MatchList matches={results} empty="No recent results" withMeta />
        </Panel>
      )}

      {tab === "squad" && <Squad squad={squad} />}

      {tab === "table" && <StandingsTable rows={standings} highlightTeamIds={[team.id]} focusTeamIds={[team.id]} />}
    </div>
  );
}

function Panel({ title, more, children }: { title: string; more?: { href: string; label: string }; children: ReactNode }) {
  return (
    <section className="rounded-card border border-hairline bg-card p-card">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-cardtitle text-text-primary">{title}</h2>
        {more && (
          <Link href={more.href} className="shrink-0 text-meta font-semibold text-text-secondary hover:text-text-primary">
            {more.label} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** `withMeta` adds the date and a competition chip above each match (Results tab, B35). */
function MatchList({ matches, empty, withMeta = false }: { matches: Match[]; empty: string; withMeta?: boolean }) {
  if (matches.length === 0) return <p className="py-3 text-center text-meta text-text-secondary">{empty}</p>;
  return (
    <ul className="divide-y divide-hairline">
      {matches.map((m) => (
        <li key={m.id}>
          {withMeta && (
            <div className="flex items-center gap-2 px-2 pt-2 text-[11px] text-text-muted">
              <LocalTime iso={m.kickoffUtc} mode="date" />
              {m.competition && (
                <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-card-2 px-2 py-0.5 text-text-secondary">
                  <Crest src={m.competition.logo} name={m.competition.name} size={12} />
                  <span className="truncate">{m.competition.name}</span>
                </span>
              )}
            </div>
          )}
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
          <h2 className="mb-2 text-cardtitle text-text-primary">{g.pos}</h2>
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
