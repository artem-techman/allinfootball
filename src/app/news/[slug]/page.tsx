import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { MediaPlaceholder } from "@/components/primitives/MediaPlaceholder";
import { ArrowRightIcon } from "@/components/primitives/icons";
import { getArticleBySlug } from "@/lib/news";
import { getCompetitionBySlug } from "@/lib/constants/competitions";
import { timeAgo, formatLongDate } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: "News" };
  return {
    title: article.title,
    description: article.dek || article.title,
    alternates: { canonical: `/news/${slug}` },
    openGraph: { title: article.title, description: article.dek, images: article.image ? [article.image] : undefined },
  };
}

/**
 * Article interstitial (CLAUDE.md sections 8 + 11). We never store the body, so
 * this shows the headline, dek, image and source with a prominent outbound link
 * to the original. If the item has rotated out of the feed, redirect to /news.
 */
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) redirect("/news");

  return (
    <AppShell>
      <article className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center gap-2 text-meta text-text-secondary">
          <span className="rounded-full bg-card-2 px-2 py-0.5 text-[11px] font-semibold uppercase text-text-primary">
            {article.sourceName}
          </span>
          <span>{formatLongDate(article.publishedAtUtc.slice(0, 10))}</span>
          <span className="text-text-muted">· {timeAgo(article.publishedAtUtc)}</span>
        </div>

        <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em] text-text-primary">{article.title}</h1>

        <div className="relative h-72 overflow-hidden rounded-card border border-hairline">
          {article.image ? (
            <div className="absolute inset-0" style={{ background: `center/cover no-repeat url(${article.image})` }} />
          ) : (
            <MediaPlaceholder className="absolute inset-0" />
          )}
        </div>

        {article.dek && <p className="text-body text-text-secondary">{article.dek}</p>}

        <a
          href={article.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-tile bg-accent-gradient px-5 py-2.5 text-meta font-semibold text-text-on-accent transition-transform hover:-translate-y-0.5"
        >
          Read full story at {article.sourceName}
          <ArrowRightIcon size={15} />
        </a>

        {article.competitionTags.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-hairline pt-4">
            {article.competitionTags.map((slugTag) => {
              const comp = getCompetitionBySlug(slugTag);
              if (!comp) return null;
              return (
                <Link
                  key={slugTag}
                  href={`/news?comp=${slugTag}`}
                  className="rounded-full border border-hairline bg-card px-3 py-1 text-meta text-text-secondary hover:text-text-primary"
                >
                  {comp.name}
                </Link>
              );
            })}
          </div>
        )}
      </article>
    </AppShell>
  );
}
