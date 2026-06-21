import Link from "next/link";
import { Crest } from "@/components/primitives/Crest";
import { ChevronRightIcon } from "@/components/primitives/icons";

export interface ScorerItem {
  rank: number;
  name: string;
  href: string;
  /** national team (or club) the player scores for */
  team: string;
  teamCrest?: string;
  /** player headshot; falls back to initials via Crest when absent */
  portraitUrl?: string;
  goals: number;
  assists: number;
}

/**
 * Home "World Cup top scorers" card — the tournament's biggest goal scorers and
 * talents as a compact ranked leaderboard. Replaces the old single-player
 * spotlight. The leader (#1) is accented in lime; each row links to the player.
 */
export function WorldCupScorersCard({ scorers }: { scorers: ScorerItem[] }) {
  const top = scorers.slice(0, 5);
  return (
    <section className="relative flex h-full min-h-[300px] flex-col overflow-hidden rounded-card border border-hairline bg-card p-card">
      {/* soft lime glow */}
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent-lime-soft blur-3xl" />

      <div className="relative mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-cardtitle text-text-primary">Top Scorers</h3>
          <p className="mt-0.5 text-meta text-text-secondary">FIFA World Cup · Golden Boot race</p>
        </div>
        <Link
          href="/competition/world-cup/scorers"
          className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-text-secondary hover:text-text-primary"
        >
          See all <ChevronRightIcon size={14} />
        </Link>
      </div>

      {top.length === 0 ? (
        <p className="relative my-auto py-6 text-center text-meta text-text-secondary">
          Scorers available once the tournament is under way.
        </p>
      ) : (
        <ol className="relative flex flex-1 flex-col justify-between">
          {top.map((s, i) => (
            <li key={`${s.rank}-${s.name}`}>
              <Link
                href={s.href}
                className="flex items-center gap-3 rounded-tile px-1.5 py-1.5 transition-colors hover:bg-white/5"
              >
                <span
                  className={`tabular w-4 shrink-0 text-center text-meta font-bold ${
                    i === 0 ? "text-accent-lime" : "text-text-secondary"
                  }`}
                >
                  {s.rank}
                </span>

                <span className="relative shrink-0">
                  <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-card-2">
                    <Crest src={s.portraitUrl} name={s.name} size={34} />
                  </span>
                  {s.teamCrest && (
                    <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center overflow-hidden rounded-full bg-card ring-2 ring-card">
                      <Crest src={s.teamCrest} name={s.team} size={12} />
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-meta font-semibold text-text-primary">{s.name}</span>
                  <span className="block truncate text-[11px] text-text-secondary">{s.team}</span>
                </span>

                <span className="shrink-0 text-right">
                  <span
                    className={`tabular text-[18px] font-bold leading-none ${
                      i === 0 ? "text-accent-lime" : "text-text-primary"
                    }`}
                  >
                    {s.goals}
                  </span>
                  <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-text-secondary">
                    {s.goals === 1 ? "goal" : "goals"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
