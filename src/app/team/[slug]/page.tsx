import type { Metadata } from "next";
import { TeamPage } from "@/components/team/TeamPage";
import { teamMetadata } from "@/lib/seo/team";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return teamMetadata(slug, "overview");
}

export default async function TeamOverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TeamPage slug={slug} tab="overview" />;
}
