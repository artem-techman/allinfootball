import Link from "next/link";
import { Crest } from "@/components/primitives/Crest";
import { Countdown } from "@/components/primitives/Countdown";
import { ShieldIcon, ChevronRightIcon } from "@/components/primitives/icons";
import { liveMinuteLabel } from "@/lib/utils/match";
import type { ClubOverview } from "@/lib/club";

/** Home widget: your club's live / next match and last result, or a prompt to pick one. */
export function MyClubCard({ overview }: { overview: ClubOverview | null }) {
  if (!overview) {
    return (
      <Link href="/my-club" className="flex items-center gap-3 rounded-card border border-dashed border-hairline bg-card p-card transition-colors hover:border-accent-lime">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-card-2 text-accent-lime">
          <ShieldIcon size={20} />
        </span>
        <span className="flex-1">
          <span className="block text-cardtitle text-text-primary">Follow your club</span>
          <span className="block text-meta text-text-secondary">Next match, results and table in one place.</span>
        </span>
        <ChevronRightIcon size={16} className="text-text-muted" />
      </Link>
    );
  }
  const { club, live, next, recent } = overview;
  const last = recent[0];
  const focus = live ?? next;
  const opp = (m: NonNullable<typeof focus>) => (m.homeTeamId === club.id ? m.awayTeam : m.homeTeam);
  return (
    <Link href="/my-club" className="block rounded-card border border-hairline bg-card p-card transition-colors hover:border-accent-lime">
      <header className="flex items-center gap-2.5">
        <Crest src={club.crest} name={club.name} size={26} />
        <h3 className="flex-1 truncate text-cardtitle text-text-primary">{club.name}</h3>
        <span className="text-[10px] font-bold uppercase tracking-wide text-accent-lime">My Club</span>
      </header>
      {focus && (
        <div className="mt-3 rounded-tile bg-card-2 px-3 py-2.5">
          <p className="text-[11px] text-text-muted">{live ? "Live now" : "Next"} · {focus.competition?.name}</p>
          <div className="mt-1 flex items-center gap-2">
            <Crest src={opp(focus)?.crest} name={opp(focus)?.name ?? ""} size={18} />
            <span className="flex-1 truncate text-meta font-semibold text-text-primary">
              {focus.homeTeamId === club.id ? "vs" : "at"} {opp(focus)?.name}
            </span>
            {live && (
              <span className="tabular text-meta font-bold text-text-primary">
                {live.homeScore ?? 0}–{live.awayScore ?? 0}{" "}
                <span className="text-live-minute">{live.status === "ht" ? "HT" : liveMinuteLabel(live)}</span>
              </span>
            )}
          </div>
          {!live && next && <Countdown kickoffUtc={next.kickoffUtc} />}
        </div>
      )}
      {last && (
        <p className="mt-2.5 truncate text-[12px] text-text-secondary">
          Last: {last.homeTeam?.name} <span className="tabular font-bold text-text-primary">{last.homeScore ?? "-"}–{last.awayScore ?? "-"}</span>{" "}
          {last.awayTeam?.name}
        </p>
      )}
    </Link>
  );
}
