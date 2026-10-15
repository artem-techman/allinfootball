import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TeamPage } from "@/components/team/TeamPage";
import { TEAM_SUBPAGES, teamMetadata, type TeamTab } from "@/lib/seo/team";

export const dynamic = "force-dynamic";

/** /team/[slug]/fixtures | results | squad | table — one search intent per URL. */
function tabOf(value: string): Exclude<TeamTab, "overview"> | undefined {
  return (TEAM_SUBPAGES as string[]).includes(value) ? (value as Exclude<TeamTab, "overview">) : undefined;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; tab: string }> }): Promise<Metadata> {
  const { slug, tab } = await params;
  const t = tabOf(tab);
  if (!t) notFound();
  return teamMetadata(slug, t);
}

export default async function TeamTabPage({ params }: { params: Promise<{ slug: string; tab: string }> }) {
  const { slug, tab } = await params;
  const t = tabOf(tab);
  if (!t) notFound();
  return <TeamPage slug={slug} tab={t} />;
}
