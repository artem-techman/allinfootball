import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { PlayerProfileView } from "@/components/player/PlayerProfileView";
import { provider } from "@/lib/providers";
import { entitySlug, idFromSlug } from "@/lib/utils/slug";
import { getCompetitionBySlug } from "@/lib/constants/competitions";
import { seasonYearFor } from "@/lib/season";
import type { PlayerProfile } from "@/lib/providers/types";

export const dynamic = "force-dynamic";

/**
 * This season's profile (it was pinned to 2025, so Haaland showed last season's
 * 58 apps / 43 goals as if current). Early in a season a player can have no
 * stat lines yet; then fall back to last season — the page labels which season
 * it shows (profile.season).
 */
async function loadProfile(id: number): Promise<PlayerProfile | undefined> {
  const current = seasonYearFor(getCompetitionBySlug("premier-league")!);
  const profile = await provider.getPlayer(id, current).catch(() => undefined);
  if (profile && (profile.stats.appearances ?? 0) > 0) return profile;
  const previous = await provider.getPlayer(id, current - 1).catch(() => undefined);
  return previous ?? profile;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const id = idFromSlug(slug);
  const profile = id ? await loadProfile(id) : undefined;
  if (!profile) return { title: "Player" };
  return {
    title: profile.player.name,
    description: `${profile.player.name} — season stats and profile on My Football Tracker.`,
    alternates: { canonical: `/player/${slug}` },
  };
}

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = idFromSlug(slug);
  if (!id) notFound();

  const profile = await loadProfile(id);
  if (!profile) notFound();
  const canonical = entitySlug(profile.player.name, id);
  if (canonical !== slug) redirect(`/player/${canonical}`);

  return (
    <AppShell>
      <PlayerProfileView profile={profile} />
    </AppShell>
  );
}
