import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { PlayerProfileView } from "@/components/player/PlayerProfileView";
import { provider } from "@/lib/providers";
import { entitySlug, idFromSlug } from "@/lib/utils/slug";
import { playerSeason } from "@/lib/seo/players";
import { JsonLd, person } from "@/components/seo/JsonLd";
import type { PlayerProfile } from "@/lib/providers/types";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

/**
 * Robots get the copy the SEO job saved from the player's squad listing (no
 * provider request); fans get a live profile, cached for hours.
 *
 * This season's profile (it was pinned to 2025, so Haaland showed last season's
 * 58 apps / 43 goals as if current). Early in a season a player can have no
 * stat lines yet; then fall back to last season — the page labels which season
 * it shows (profile.season).
 */
async function loadProfile(id: number): Promise<PlayerProfile | undefined> {
  const current = playerSeason();
  const profile = await provider.getPlayer(id, current).catch(() => undefined);
  if (profile && (profile.stats.appearances ?? 0) > 0) return profile;
  const previous = await provider.getPlayer(id, current - 1).catch(() => undefined);
  return previous ?? profile;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const id = idFromSlug(slug);
  const profile = id ? await loadProfile(id) : undefined;
  if (!profile || !id) notFound(); // real 404 status (metadata is blocking)
  const season = profile.seasonLabel ? ` ${profile.seasonLabel}` : "";
  const name = profile.displayName ?? profile.player.name;
  return buildMetadata({
    title: `${name} stats${season}: goals, assists & profile`,
    description: `${name}${profile.teamName ? ` (${profile.teamName})` : ""}: appearances, goals, assists, minutes and cards for the${season} season, plus position, age and nationality.`,
    path: `/player/${entitySlug(profile.player.name, id)}`,
    // A squad player yet to feature has nothing worth a search result.
    ...(profile.stats.appearances ? {} : { robots: { index: false, follow: true } }),
  });
}

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = idFromSlug(slug);
  if (!id) notFound();

  const profile = await loadProfile(id);
  if (!profile) notFound();
  const canonical = entitySlug(profile.player.name, id);
  if (canonical !== slug) permanentRedirect(`/player/${canonical}`);

  return (
    <AppShell>
      <JsonLd data={person(profile, canonical)} />
      <PlayerProfileView profile={profile} />
    </AppShell>
  );
}
