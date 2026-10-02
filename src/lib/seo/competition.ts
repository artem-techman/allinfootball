import type { Metadata } from "next";
import { getCompetitionBySlug } from "@/lib/constants/competitions";
import { buildMetadata } from "./metadata";

export type CompetitionTab = "fixtures" | "table" | "scorers" | "news";

const COPY: Record<CompetitionTab, { title: string; fallback: string; description: (name: string) => string }> = {
  fixtures: {
    title: "Fixtures",
    fallback: "Fixtures",
    description: (n) => `${n} fixtures: upcoming matches, kick-off times and results on My Football Tracker.`,
  },
  table: {
    title: "Table",
    fallback: "Table",
    description: (n) => `${n} table: live standings, points, goal difference and form on My Football Tracker.`,
  },
  scorers: {
    title: "Top Scorers",
    fallback: "Top Scorers",
    description: (n) => `${n} top scorers: the leading goalscorers and assist providers on My Football Tracker.`,
  },
  news: {
    title: "News",
    fallback: "News",
    description: (n) => `The latest ${n} news: headlines from trusted sources, linked to the original publisher.`,
  },
};

/** Metadata for /competition/[slug]/[tab]. Unknown slugs 404 in the page. */
export function competitionTabMetadata(slug: string, tab: CompetitionTab): Metadata {
  const comp = getCompetitionBySlug(slug);
  const copy = COPY[tab];
  if (!comp) return { title: copy.fallback };
  return buildMetadata({
    title: `${comp.name} ${copy.title}`,
    description: copy.description(comp.name),
    path: `/competition/${comp.slug}/${tab}`,
  });
}
