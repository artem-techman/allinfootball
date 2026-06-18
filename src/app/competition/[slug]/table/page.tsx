import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompetitionLayout } from "@/components/competition/CompetitionLayout";
import { StandingsTable } from "@/components/tables/StandingsTable";
import { ThirdPlaceTable } from "@/components/tables/ThirdPlaceTable";
import { provider } from "@/lib/providers";
import { getCompetitionBySlug } from "@/lib/constants/competitions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const comp = getCompetitionBySlug(slug);
  return {
    title: comp ? `${comp.name} Table` : "Table",
    alternates: { canonical: `/competition/${slug}/table` },
  };
}

export default async function CompetitionTablePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const comp = getCompetitionBySlug(slug);
  if (!comp) notFound();

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
