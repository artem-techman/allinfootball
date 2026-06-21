import { HighlightEmbed } from "./HighlightEmbed";
import { LocalTime } from "@/components/primitives/LocalTime";
import { getCompetitionBySlug } from "@/lib/constants/competitions";
import type { Highlight } from "@/lib/highlights";

/** A highlights tile: an inline (click-to-play) player + competition tag, title and meta. */
export function HighlightCard({ highlight }: { highlight: Highlight }) {
  const comp = highlight.competitionSlug ? getCompetitionBySlug(highlight.competitionSlug) : undefined;
  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-hairline bg-card">
      <HighlightEmbed title={highlight.title} thumbnailUrl={highlight.thumbnailUrl} embedUrl={highlight.embedUrl} />
      <div className="flex flex-1 flex-col p-3">
        {comp && (
          <span className="mb-1.5 inline-flex w-fit items-center rounded-full bg-accent-lime-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-lime-dim">
            {comp.name}
          </span>
        )}
        <h3 className="line-clamp-2 text-meta font-semibold text-text-primary">{highlight.title}</h3>
        <p className="mt-2 text-[11px] text-text-secondary">
          {highlight.channelTitle} · <LocalTime iso={highlight.publishedAtUtc} mode="date" />
        </p>
      </div>
    </article>
  );
}
