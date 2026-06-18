import type { Article } from "@/lib/providers/types";
import { NewsCard } from "./NewsCard";
import { MediaPlaceholder } from "@/components/primitives/MediaPlaceholder";
import { EmptyState } from "@/components/primitives/EmptyState";
import { timeAgo } from "@/lib/utils/date";

/**
 * News river (CLAUDE.md section 11): a featured lead story plus a responsive grid
 * of cards. Only items relevant to the nine competitions reach here (filtered
 * upstream). Link-out only — no article bodies.
 */
export function NewsRiver({ articles }: { articles: Article[] }) {
  if (articles.length === 0) {
    return <EmptyState title="No football news right now" hint="Headlines refresh every few minutes." />;
  }
  const [lead, ...rest] = articles;

  return (
    <div className="space-y-5">
      <FeaturedNews article={lead} />
      {rest.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((a) => (
            <NewsCard key={a.id} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeaturedNews({ article }: { article: Article }) {
  return (
    <a
      href={article.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group grid overflow-hidden rounded-card border border-hairline bg-card md:grid-cols-2"
    >
      <div className="relative min-h-[220px] overflow-hidden">
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
      <div className="flex flex-col justify-center p-6">
        <h2 className="text-section leading-tight text-text-primary">{article.title}</h2>
        {article.dek && <p className="mt-2 line-clamp-3 text-body text-text-secondary">{article.dek}</p>}
        <div className="mt-4 flex items-center gap-2 text-meta">
          <span className="text-text-muted">{timeAgo(article.publishedAtUtc)}</span>
          <span className="font-semibold text-text-primary group-hover:text-accent-lime">
            Read full story at {article.sourceName} →
          </span>
        </div>
      </div>
    </a>
  );
}
