"use client";

import { useMemo, useState } from "react";
import { HighlightCard } from "./HighlightCard";
import { getCompetitionBySlug } from "@/lib/constants/competitions";
import type { Highlight } from "@/lib/highlights";

/** Responsive highlights grid with competition filter chips. */
export function FeedGrid({ highlights }: { highlights: Highlight[] }) {
  const [slug, setSlug] = useState<string | null>(null);

  // Only show chips for competitions actually present in the feed.
  const chips = useMemo(() => {
    const slugs = [...new Set(highlights.map((h) => h.competitionSlug).filter(Boolean))] as string[];
    return slugs
      .map((s) => getCompetitionBySlug(s))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
  }, [highlights]);

  const shown = slug ? highlights.filter((h) => h.competitionSlug === slug) : highlights;

  return (
    <>
      {chips.length > 1 && (
        <div className="mb-5 flex gap-2 overflow-x-auto overflow-y-hidden pb-1">
          <Chip active={slug === null} onClick={() => setSlug(null)}>
            All
          </Chip>
          {chips.map((c) => (
            <Chip key={c.slug} active={slug === c.slug} onClick={() => setSlug(c.slug)}>
              {c.name}
            </Chip>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((h) => (
          <HighlightCard key={h.id} highlight={h} />
        ))}
      </div>
    </>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-meta font-semibold transition-colors ${
        active
          ? "border-accent-lime bg-accent-lime text-text-on-accent"
          : "border-hairline bg-card text-text-secondary hover:border-white/15 hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}
