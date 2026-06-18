import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Crest } from "@/components/primitives/Crest";
import { JsonLd, breadcrumb } from "@/components/seo/JsonLd";
import { getCompetitionBySlug } from "@/lib/constants/competitions";

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
      <header className="mb-5 flex items-center gap-4">
        <Crest src={LEAGUE_LOGO(comp.leagueId)} name={comp.name} size={52} />
        <div>
          <h1 className="text-greeting text-text-primary">{comp.name}</h1>
          <p className="mt-0.5 text-meta text-text-secondary">
            {comp.country} · Season {seasonLabel}
          </p>
        </div>
      </header>

      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-hairline">
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
              {isActive && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent-lime" />}
            </Link>
          );
        })}
      </nav>

      {children}
    </AppShell>
  );
}
