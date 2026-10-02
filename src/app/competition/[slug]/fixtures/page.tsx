import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompetitionLayout } from "@/components/competition/CompetitionLayout";
import { CompetitionFixtures } from "@/components/competition/CompetitionFixtures";
import { provider } from "@/lib/providers";
import { getCompetitionBySlug } from "@/lib/constants/competitions";
import { currentSeasonYear } from "@/lib/season";
import { competitionTabMetadata } from "@/lib/seo/competition";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return competitionTabMetadata(slug, "fixtures");
}

export default async function CompetitionFixturesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const comp = getCompetitionBySlug(slug);
  if (!comp) notFound();

  const season = await currentSeasonYear(comp);
  const matches = await provider.getFixturesByLeague(comp.leagueId, season).catch(() => []);

  return (
    <CompetitionLayout slug={slug} active="fixtures">
      <CompetitionFixtures matches={matches} />
    </CompetitionLayout>
  );
}
