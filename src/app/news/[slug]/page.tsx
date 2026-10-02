import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { MediaPlaceholder } from "@/components/primitives/MediaPlaceholder";
import { ArrowRightIcon } from "@/components/primitives/icons";
import { getArticleBySlug } from "@/lib/news";
import { getCompetitionBySlug } from "@/lib/constants/competitions";
import { timeAgo, formatLongDate } from "@/lib/utils/date";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

/**
 * B20: this page is a thin headline + link-out interstitial, so it is
 * `noindex, follow` (search engines follow the link to the publisher but don't
 * index our copy of the headline). The share image is always the site image —
 * publisher photos are never hotlinked into og:image.
 */
const ROBOTS = { index: false, follow: true } as const;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: "News", robots: ROBOTS };
  return buildMetadata({
    title: article.title,
    description: article.dek || `${article.title} (${article.sourceName})`,
    path: `/news/${article.slug}`,
    type: "article",
    robots: ROBOTS,
  });
}

/**
 * Article interstitial (CLAUDE.md sections 8 + 11). We never store the body, so
 * this shows the headline, dek, image and source with a prominent outbound link
 * to the original. An item that has rotated out of the feed (or never existed)
 * is a real 404 — not a redirect to /news, which made every dead link look like
 * a live duplicate of the news index.
 */
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();
  const dated = Boolean(article.publishedAtUtc);

  return (
    <AppShell>
      <article className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center gap-2 text-meta text-text-secondary">
          <span className="rounded-full bg-card-2 px-2 py-0.5 text-[11px] font-semibold uppercase text-text-primary">
            {article.sourceName}
          </span>
          {dated && <span>{formatLongDate(article.publishedAtUtc.slice(0, 10))}</span>}
          {dated && <span className="text-text-muted">· {timeAgo(article.publishedAtUtc)}</span>}
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
