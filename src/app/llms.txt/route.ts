import { COMPETITIONS } from "@/lib/constants/competitions";

/**
 * /llms.txt: a plain-text map of the site for AI assistants (the llms.txt
 * convention): what we cover, and the URL patterns that answer common football
 * questions. Every page listed is server-rendered HTML with scores, tables and
 * kick-off times in the markup, so no JavaScript is needed to read it.
 */
export const dynamic = "force-static";
export const revalidate = 86400;

const SITE = "https://myfootballtracker.com";

export function GET() {
  const comps = COMPETITIONS.map(
    (c) => `- [${c.name} table](${SITE}/competition/${c.slug}/table): standings, form. Also /fixtures, /scorers and /news under ${SITE}/competition/${c.slug}/`,
  ).join("\n");
  const body = `# My Football Tracker

> Live football scores, fixtures, results, league tables, match stats and lineups for ${COMPETITIONS.length} competitions: ${COMPETITIONS.map((c) => c.name).join(", ")}. Free, no sign-in needed. Updated live during matches.

Times on every page are given in UK time in the text, and as exact UTC in each <time datetime="..."> attribute. Scores, tables and lineups come from a licensed football data provider and refresh about every 30 seconds while matches are live.

## Matches by day
- [Today's matches](${SITE}/matches/today): every fixture today, with live scores and results
- [Tomorrow](${SITE}/matches/tomorrow) and [yesterday](${SITE}/matches/yesterday)
- Any date: ${SITE}/matches/YYYY-MM-DD (for example ${SITE}/matches/2026-11-08)

## Single match
- ${SITE}/match/{home}-{away}-{fixtureId}: score, goal timeline, cards, substitutions, lineups, team stats, head-to-head, injuries and team news. Find the exact URL from the day page or the sitemap.

## Competitions
${comps}
- Matchday / gameweek pages: ${SITE}/competition/{competition}/round/{round}, for example ${SITE}/competition/premier-league/round/gameweek-10 and ${SITE}/competition/champions-league/round/matchday-4

## Teams and players
- ${SITE}/team/{team-slug}: next match, recent form, table position. Sub-pages /fixtures, /results and /squad
- ${SITE}/player/{player-slug}: season goals, assists, appearances

## Other
- [News](${SITE}/news): headlines from major outlets, linked to the original source
- [Sitemap](${SITE}/sitemap.xml): every match, team, round and player URL
- [About](${SITE}/about)
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
