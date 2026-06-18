import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompetitionLayout } from "@/components/competition/CompetitionLayout";
import { TopScorersTable } from "@/components/tables/TopScorersTable";
import { provider } from "@/lib/providers";
import { getCompetitionBySlug } from "@/lib/constants/competitions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const comp = getCompetitionBySlug(slug);
  return {
    title: comp ? `${comp.name} Top Scorers` : "Top Scorers",
    alternates: { canonical: `/competition/${slug}/scorers` },
  };
}

export default async function CompetitionScorersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const comp = getCompetitionBySlug(slug);
  if (!comp) notFound();

  const [scorers, assists] = await Promise.all([
    provider.getTopScorers(comp.leagueId, comp.defaultSeason).catch(() => []),
    provider.getTopAssists(comp.leagueId, comp.defaultSeason).catch(() => []),
  ]);

  return (
    <CompetitionLayout slug={slug} active="scorers">
      <TopScorersTable scorers={scorers} assists={assists} />
    </CompetitionLayout>
  );
}
