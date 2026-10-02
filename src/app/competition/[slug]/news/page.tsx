import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompetitionLayout } from "@/components/competition/CompetitionLayout";
import { NewsRiver } from "@/components/news/NewsRiver";
import { getNews } from "@/lib/news";
import { getCompetitionBySlug } from "@/lib/constants/competitions";
import { competitionTabMetadata } from "@/lib/seo/competition";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return competitionTabMetadata(slug, "news");
}

export default async function CompetitionNewsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const comp = getCompetitionBySlug(slug);
  if (!comp) notFound();

  const articles = await getNews({ comp: slug, limit: 24 });

  return (
    <CompetitionLayout slug={slug} active="news">
      <NewsRiver articles={articles} />
    </CompetitionLayout>
  );
}
