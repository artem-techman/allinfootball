import type { Article } from "@/lib/providers/types";
import { MediaPlaceholder } from "@/components/primitives/MediaPlaceholder";
import { timeAgo } from "@/lib/utils/date";

/**
 * News card (CLAUDE.md section 11): image (or minimal placeholder), source pill,
 * headline, dek, time, and an outbound "Read full story" link to the source.
 * Link-out only — we never render the article body. Opens the original in a new
 * tab with rel="noopener".
 */
export function NewsCard({ article }: { article: Article }) {
  return (
    <a
      href={article.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex h-full flex-col overflow-hidden rounded-card border border-hairline bg-card transition-colors hover:border-white/15"
    >
      <div className="relative h-40 overflow-hidden">
        {article.image ? (
          <div
            aria-hidden
            className="absolute inset-0 transition-transform duration-300 group-hover:scale-[1.03]"
            style={{ background: `center/cover no-repeat url(${article.image})` }}
          />
        ) : (
          <MediaPlaceholder className="absolute inset-0" />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-surface-dark-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-on-dark">
          {article.sourceName}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-card">
        <h3 className="line-clamp-2 text-cardtitle leading-snug text-text-primary">{article.title}</h3>
        {article.dek && <p className="mt-1.5 line-clamp-2 text-meta text-text-secondary">{article.dek}</p>}
        <div className="mt-auto flex items-center justify-between pt-3 text-[11px]">
          <span className="text-text-muted">{timeAgo(article.publishedAtUtc)}</span>
          <span className="font-semibold text-text-primary group-hover:text-accent-lime">
            Read at {article.sourceName} →
          </span>
        </div>
      </div>
    </a>
  );
}
