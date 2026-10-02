import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { PlayerProfileView } from "@/components/player/PlayerProfileView";
import { provider } from "@/lib/providers";
import { entitySlug, idFromSlug } from "@/lib/utils/slug";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

// Domestic season; covers players who appear in the nine leagues' scorer lists.
const PROFILE_SEASON = 2025;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const id = idFromSlug(slug);
  const profile = id ? await provider.getPlayer(id, PROFILE_SEASON).catch(() => undefined) : undefined;
  if (!profile || !id) return { title: "Player" };
  return buildMetadata({
    title: profile.player.name,
    description: `${profile.player.name}: season stats and profile on My Football Tracker.`,
    path: `/player/${entitySlug(profile.player.name, id)}`,
  });
}

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = idFromSlug(slug);
  if (!id) notFound();

  const profile = await provider.getPlayer(id, PROFILE_SEASON).catch(() => undefined);
  if (!profile) notFound();
  const canonical = entitySlug(profile.player.name, id);
  if (canonical !== slug) permanentRedirect(`/player/${canonical}`);

  return (
    <AppShell>
      <PlayerProfileView profile={profile} />
    </AppShell>
  );
}
