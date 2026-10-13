import Link from "next/link";
import { Crest } from "@/components/primitives/Crest";
import { Countdown } from "@/components/primitives/Countdown";
import { LocalTime } from "@/components/primitives/LocalTime";
import { MatchCard } from "@/components/cards/MatchCard";
import { StandingsTable } from "@/components/tables/StandingsTable";
import { liveMinuteLabel } from "@/lib/utils/match";
import type { ClubOverview } from "@/lib/club";
import type { Match } from "@/lib/providers/types";

/** The My Club page body: hero (live / next match), results, fixtures, table. */
export function ClubDashboard({ overview }: { overview: ClubOverview }) {
  const { club, live, next, recent, upcoming, table } = overview;
  const focus = live ?? next;
  return (
    <div className="space-y-5">
      <header className="flex items-center gap-4">
        <Crest src={club.crest} name={club.name} size={56} />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-accent-lime">My Club</p>
          <h1 className="text-greeting text-text-primary">{club.name}</h1>
        </div>
      </header>

      {focus && <FocusMatch match={focus} clubId={club.id} />}

      <section>
        <h2 className="mb-3 text-section text-text-primary">Recent results</h2>
        {recent.length ? (
          <div className="grid gap-2">{recent.map((m) => <MatchCard key={m.id} match={m} />)}</div>
        ) : (
          <p className="text-meta text-text-secondary">No results yet this season.</p>
        )}
      </section>

      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-3 text-section text-text-primary">Coming up</h2>
          <div className="grid gap-2">{upcoming.map((m) => <MatchCard key={m.id} match={m} />)}</div>
        </section>
      )}

      {table && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-section text-text-primary">{table.competition}</h2>
            <Link href={`/competition/${table.slug}/table`} className="text-[12px] font-semibold text-text-secondary hover:text-text-primary">
              Full table
            </Link>
          </div>
          <StandingsTable rows={table.rows} highlightTeamIds={[club.id]} focusTeamIds={[club.id]} />
        </section>
      )}
    </div>
  );
}

function FocusMatch({ match, clubId }: { match: Match; clubId: number }) {
  const isLive = match.status === "live" || match.status === "ht";
  const home = match.homeTeamId === clubId;
  const opponent = home ? match.awayTeam : match.homeTeam;
  return (
    <Link
      href={`/match/${match.slug}`}
      className={`block rounded-card p-card ${isLive ? "mft-gradient-border" : "border border-hairline bg-card"}`}
    >
      <div className={isLive ? "rounded-[15px] bg-card p-card" : ""}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
          {isLive ? "Live now" : "Next match"} · {match.competition?.name}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Crest src={opponent?.crest} name={opponent?.name ?? "Opponent"} size={34} />
          <p className="flex-1 text-cardtitle text-text-primary">
            {home ? "vs" : "at"} {opponent?.name}
          </p>
          {isLive ? (
            <span className="tabular text-section font-bold text-text-primary">
              {match.homeScore ?? 0}–{match.awayScore ?? 0}{" "}
              <span className="text-meta text-live-minute">{match.status === "ht" ? "HT" : liveMinuteLabel(match)}</span>
            </span>
          ) : (
            <span className="text-right text-meta text-text-secondary">
              <LocalTime iso={match.kickoffUtc} mode="date" />
            </span>
          )}
        </div>
        {!isLive && <Countdown kickoffUtc={match.kickoffUtc} />}
      </div>
    </Link>
  );
}
