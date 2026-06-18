import Link from "next/link";
import type { PlayerProfile } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";
import { entitySlug } from "@/lib/utils/slug";

/** Player profile (CLAUDE.md section 8): header + season stat tiles. */
export function PlayerProfileView({ profile }: { profile: PlayerProfile }) {
  const { player, stats } = profile;
  const photo = profile.photo ?? `https://media.api-sports.io/football/players/${player.id}.png`;
  const meta = [profile.teamName, player.position, player.nationality].filter(Boolean).join(" · ");

  const tiles: { label: string; value: string }[] = [
    { label: "Appearances", value: numOrDash(stats.appearances) },
    { label: "Goals", value: numOrDash(stats.goals) },
    { label: "Assists", value: numOrDash(stats.assists) },
    { label: "Minutes", value: numOrDash(stats.minutes) },
    { label: "Yellow", value: numOrDash(stats.yellow) },
    { label: "Red", value: numOrDash(stats.red) },
    { label: "Rating", value: stats.rating != null ? stats.rating.toFixed(2) : "-" },
  ];

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-4 rounded-card border border-hairline bg-card p-card">
        <span
          className="h-20 w-20 shrink-0 rounded-full bg-card-2 bg-cover bg-center"
          style={{ backgroundImage: `url(${photo})` }}
          aria-label={player.name}
          role="img"
        />
        <div className="min-w-0">
          <h1 className="text-greeting text-text-primary">{player.name}</h1>
          <p className="mt-0.5 text-meta text-text-secondary">{meta}</p>
          <p className="mt-1 text-meta text-text-muted">
            {[profile.age ? `Age ${profile.age}` : null, profile.height, profile.weight].filter(Boolean).join(" · ")}
          </p>
          {profile.teamName && profile.teamId && (
            <Link
              href={`/team/${entitySlug(profile.teamName, profile.teamId)}`}
              className="mt-2 inline-flex items-center gap-1.5 text-meta font-semibold text-text-primary hover:text-accent-lime"
            >
              <Crest src={`https://media.api-sports.io/football/teams/${profile.teamId}.png`} name={profile.teamName} size={16} />
              {profile.teamName}
            </Link>
          )}
        </div>
      </header>

      <section className="rounded-card border border-hairline bg-card p-card">
        <h3 className="mb-3 text-cardtitle text-text-primary">Season stats</h3>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-tile border border-hairline bg-card-2 p-3 text-center">
              <div className="tabular text-section font-bold text-text-primary">{t.value}</div>
              <div className="mt-1 text-[10px] uppercase tracking-wide text-text-muted">{t.label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function numOrDash(n?: number): string {
  return n != null ? String(n) : "-";
}
