import type { Match, MatchEvent, Standing } from "@/lib/providers/types";
import { previewText, reportText, resultFor } from "@/lib/seo/matchCopy";

/**
 * Written match preview (upcoming) or report (finished), built from our data.
 * Server-rendered, so it's in the HTML search engines read; also genuinely
 * useful for fans landing on a match page before kick-off.
 */
export function MatchStory({
  match,
  events,
  h2h,
  table,
  homeForm,
  awayForm,
}: {
  match: Match;
  events: MatchEvent[];
  h2h: Match[];
  table: Standing[];
  homeForm: Match[];
  awayForm: Match[];
}) {
  const upcoming = match.status === "scheduled";
  const finished = match.status === "finished";
  if (!upcoming && !finished) return null;
  const paragraphs = upcoming ? previewText({ match, homeForm, awayForm, h2h, table }) : reportText(match, events);
  return (
    <section className="rounded-card border border-hairline bg-card p-card" aria-labelledby="match-story">
      <h2 id="match-story" className="text-cardtitle text-text-primary">
        {upcoming ? "Match preview" : "Match report"}
      </h2>
      {upcoming && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <FormStrip name={match.homeTeam?.name ?? "Home"} teamId={match.homeTeamId} games={homeForm} />
          <FormStrip name={match.awayTeam?.name ?? "Away"} teamId={match.awayTeamId} games={awayForm} />
        </div>
      )}
      <div className="mt-3 space-y-2 text-body leading-relaxed text-text-secondary">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </section>
  );
}

const PILL: Record<string, string> = {
  W: "bg-accent-lime text-[#0b0c0e]",
  D: "bg-card-2 text-text-secondary",
  L: "bg-[#ef4444] text-white",
};

function FormStrip({ name, teamId, games }: { name: string; teamId: number; games: Match[] }) {
  const form = games.map((g) => resultFor(g, teamId)).filter(Boolean).slice(0, 5) as ("W" | "D" | "L")[];
  if (!form.length) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-tile bg-card-2 px-3 py-2">
      <span className="truncate text-meta font-semibold text-text-primary">{name}</span>
      <span className="flex gap-1" aria-label={`${name} last ${form.length}: ${form.join(" ")}`}>
        {form.map((r, i) => (
          <span key={i} className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${PILL[r]}`}>
            {r}
          </span>
        ))}
      </span>
    </div>
  );
}
