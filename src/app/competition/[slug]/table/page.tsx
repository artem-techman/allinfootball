import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompetitionLayout } from "@/components/competition/CompetitionLayout";
import { StandingsTable } from "@/components/tables/StandingsTable";
import { ThirdPlaceTable } from "@/components/tables/ThirdPlaceTable";
import { WorldCupBracket } from "@/components/cards/WorldCupBracket";
import { EmptyState } from "@/components/primitives/EmptyState";
import { provider } from "@/lib/providers";
import { getCompetitionBySlug } from "@/lib/constants/competitions";
import { loadWorldCupBracket } from "@/lib/worldcup/bracket";
import { PREVIEW_BRACKET } from "@/lib/preview/homePreview";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const comp = getCompetitionBySlug(slug);
  return {
    title: comp ? `${comp.name} Table` : "Table",
    description: comp ? `${comp.name} table — live standings, points, goal difference and form on My Football Tracker.` : undefined,
    alternates: { canonical: `/competition/${slug}/table` },
  };
}

export default async function CompetitionTablePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const comp = getCompetitionBySlug(slug);
  if (!comp) notFound();

  // The World Cup has reached the knockout stage, so its Table tab shows the same
  // knockout bracket as the home page instead of the now-finished group standings.
  // The demo bracket is for the keyless demo ONLY: with a real key, a transient
  // provider failure previously rendered a fictional bracket (Italy, Wales and
  // Uruguay in a tournament they never entered) indistinguishable from real data.
  // An unavailable bracket now hides the widget instead of inventing one.
  if (slug === "world-cup") {
    const bracket = await loadWorldCupBracket();
    const demo = !process.env.FOOTBALL_API_KEY;
    const rounds = bracket.length > 0 ? bracket : demo ? PREVIEW_BRACKET : [];
    return (
      <CompetitionLayout slug={slug} active="table">
        {rounds.length > 0 ? (
          <WorldCupBracket rounds={rounds} />
        ) : (
          <EmptyState
            title="Bracket temporarily unavailable"
            hint="The knockout bracket couldn't be loaded just now. Please check back shortly."
          />
        )}
      </CompetitionLayout>
    );
  }

  const standings = await provider.getStandings(comp.leagueId, comp.defaultSeason).catch(() => []);

  return (
    <CompetitionLayout slug={slug} active="table">
      <div className="space-y-5">
        <StandingsTable rows={standings} />
        <ThirdPlaceTable rows={standings} />
      </div>
    </CompetitionLayout>
  );
}
