import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Crest } from "@/components/primitives/Crest";
import { JsonLd, breadcrumb } from "@/components/seo/JsonLd";
import { getCompetitionBySlug, COMPETITIONS } from "@/lib/constants/competitions";

export type CompetitionTab = "fixtures" | "table" | "scorers" | "news";

const TABS: { id: CompetitionTab; label: string }[] = [
  { id: "fixtures", label: "Fixtures" },
  { id: "table", label: "Table" },
  { id: "scorers", label: "Scorers" },
  { id: "news", label: "News" },
];

const LEAGUE_LOGO = (id: number) => `https://media.api-sports.io/football/leagues/${id}.png`;

/**
 * Competition hub chrome (CLAUDE.md section 8): crest + name + country header and
 * a Fixtures / Table / Scorers / News tab bar. Each sub-page renders its own data
 * as children; the active tab is highlighted via the route.
 */
export function CompetitionLayout({
  slug,
  active,
  children,
}: {
  slug: string;
  active: CompetitionTab;
  children: ReactNode;
}) {
  const comp = getCompetitionBySlug(slug);
  if (!comp) notFound();
  const seasonLabel =
    comp.type === "league" && comp.defaultSeason < 2026
      ? `${comp.defaultSeason}/${(comp.defaultSeason + 1) % 100}`
      : `${comp.defaultSeason}`;

  return (
    <AppShell wide>
      <JsonLd
        data={breadcrumb([
          { name: "Competitions", path: "/competition/premier-league" },
          { name: comp.name, path: `/competition/${slug}/${active}` },
        ])}
      />
      {/* league switcher — all nine competitions; switching keeps the active tab */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {COMPETITIONS.map((c) => {
          const isActive = c.slug === slug;
          return (
            <Link
              key={c.slug}
              href={`/competition/${c.slug}/${active}`}
              aria-current={isActive ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-meta font-semibold transition-colors ${
                isActive
                  ? "border-accent-lime bg-accent-lime text-text-on-accent"
                  : "border-hairline bg-card text-text-secondary hover:border-white/15 hover:text-text-primary"
              }`}
            >
              <Crest src={LEAGUE_LOGO(c.leagueId)} name={c.name} size={18} />
              {c.name}
            </Link>
          );
        })}
      </div>

      <header className="mb-5 flex items-center gap-4">
        <Crest src={LEAGUE_LOGO(comp.leagueId)} name={comp.name} size={52} />
        <div>
          <h1 className="text-greeting text-text-primary">{comp.name}</h1>
          <p className="mt-0.5 text-meta text-text-secondary">
            {comp.country} · Season {seasonLabel}
          </p>
        </div>
      </header>

      <nav className="mb-5 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-hairline">
        {TABS.map((t) => {
          const isActive = t.id === active;
          return (
            <Link
              key={t.id}
              href={`/competition/${slug}/${t.id}`}
              aria-current={isActive ? "page" : undefined}
              className={`relative whitespace-nowrap px-3.5 py-2.5 text-meta font-semibold transition-colors ${
                isActive ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {t.label}
              {isActive && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent-lime" />}
            </Link>
          );
        })}
      </nav>

      {children}
    </AppShell>
  );
}
