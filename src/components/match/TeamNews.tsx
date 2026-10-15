import { Suspense } from "react";
import { Crest } from "@/components/primitives/Crest";
import { getNews } from "@/lib/news";
import { matchTeamNews } from "@/lib/news/teamNews";
import { absenceReason } from "@/lib/seo/matchCopy";
import { timeAgo } from "@/lib/utils/date";
import type { Article, Injury, Match, Team } from "@/lib/providers/types";

/**
 * "Team news" on an upcoming match: who's out or doubtful (injuries and
 * suspensions, saved by the SEO job — zero requests at view time) and the
 * latest headlines about each club from the news river (link-out only).
 * Headlines stream in; the absences render immediately.
 */
export function TeamNews({ match, absences }: { match: Match; absences?: Injury[] }) {
  return (
    <Suspense fallback={<TeamNewsView match={match} absences={absences} />}>
      <WithHeadlines match={match} absences={absences} />
    </Suspense>
  );
}

async function WithHeadlines({ match, absences }: { match: Match; absences?: Injury[] }) {
  // The river is cached for minutes; never let a slow feed hold the page.
  const articles = await Promise.race([
    getNews().catch(() => [] as Article[]),
    new Promise<Article[]>((resolve) => setTimeout(() => resolve([]), 2_500)),
  ]);
  const news = matchTeamNews(articles, match.homeTeam?.name ?? "", match.awayTeam?.name ?? "");
  return <TeamNewsView match={match} absences={absences} news={news} />;
}

function TeamNewsView({
  match,
  absences,
  news,
}: {
  match: Match;
  absences?: Injury[];
  news?: { home: Article[]; away: Article[] };
}) {
  const hasAny = absences !== undefined || (news && (news.home.length > 0 || news.away.length > 0));
  if (!hasAny) return null;
  return (
    <section className="rounded-card border border-hairline bg-card p-card" aria-labelledby="team-news">
      <h2 id="team-news" className="text-cardtitle text-text-primary">
        Team news
      </h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Side team={match.homeTeam} absences={absences?.filter((x) => x.teamId === match.homeTeamId)} news={news?.home} />
        <Side team={match.awayTeam} absences={absences?.filter((x) => x.teamId === match.awayTeamId)} news={news?.away} />
      </div>
    </section>
  );
}

function Side({ team, absences, news }: { team?: Team; absences?: Injury[]; news?: Article[] }) {
  const ordered = absences ? [...absences].sort((a, b) => (a.status === b.status ? 0 : a.status === "out" ? -1 : 1)) : undefined;
  return (
    <div className="rounded-tile bg-card-2 p-3">
      <div className="flex items-center gap-2">
        <Crest src={team?.crest} name={team?.name ?? ""} size={20} />
        <h3 className="truncate text-meta font-semibold text-text-primary">{team?.name}</h3>
      </div>

      {ordered && (
        <ul className="mt-2.5 space-y-1.5">
          {ordered.length === 0 && <li className="text-meta text-text-secondary">No reported injuries or suspensions.</li>}
          {ordered.map((x) => (
            <li key={x.playerId} className="flex items-baseline gap-2 text-meta">
              <span
                className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ${
                  x.status === "out" ? "bg-[#ef4444]/15 text-[#f87171]" : "bg-[#f59e0b]/15 text-[#fbbf24]"
                }`}
              >
                {x.status === "out" ? "Out" : "Doubt"}
              </span>
              <span className="min-w-0 truncate font-medium text-text-primary">{x.name}</span>
              <span className="min-w-0 shrink truncate text-text-secondary">{absenceReason(x.reason)}</span>
            </li>
          ))}
        </ul>
      )}

      {news && news.length > 0 && (
        <ul className={`space-y-2 ${ordered ? "mt-3 border-t border-hairline pt-3" : "mt-2.5"}`}>
          {news.map((a) => (
            <li key={a.id}>
              <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer" className="group block">
                <span className="line-clamp-2 text-meta font-medium text-text-primary group-hover:underline">{a.title}</span>
                <span className="mt-0.5 block text-[11px] text-text-secondary">
                  {a.sourceName}
                  {a.publishedAtUtc ? ` · ${timeAgo(a.publishedAtUtc)}` : ""}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
