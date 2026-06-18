import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { PlayerProfileView } from "@/components/player/PlayerProfileView";
import { provider } from "@/lib/providers";
import { idFromSlug } from "@/lib/utils/slug";

export const dynamic = "force-dynamic";

// Domestic season; covers players who appear in the nine leagues' scorer lists.
const PROFILE_SEASON = 2025;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const id = idFromSlug(slug);
  const profile = id ? await provider.getPlayer(id, PROFILE_SEASON).catch(() => undefined) : undefined;
  if (!profile) return { title: "Player" };
  return {
    title: profile.player.name,
    description: `${profile.player.name} — season stats and profile on All In Football.`,
    alternates: { canonical: `/player/${slug}` },
  };
}

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = idFromSlug(slug);
  if (!id) notFound();

  const profile = await provider.getPlayer(id, PROFILE_SEASON).catch(() => undefined);
  if (!profile) notFound();

  return (
    <AppShell>
      <PlayerProfileView profile={profile} />
    </AppShell>
  );
}
