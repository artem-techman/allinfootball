import Link from "next/link";
import type { Article } from "@/lib/providers/types";
import { MediaPlaceholder } from "@/components/primitives/MediaPlaceholder";
import { timeAgo } from "@/lib/utils/date";

/**
 * Transfer Talk rail (CLAUDE.md section 8): transfer-tagged news (link-out only).
 * A lead item with a thumbnail plus a couple of headlines, all linking to the
 * source. "Transfers" in v1 is a news filter, not a separate data feed.
 */
export function TransferRumoursRail({ articles }: { articles: Article[] }) {
  if (articles.length === 0) {
    return (
      <section className="rounded-card border border-hairline bg-card p-card">
        <h3 className="mb-2 text-cardtitle text-text-primary">Transfer Talk</h3>
        <p className="py-3 text-center text-meta text-text-secondary">No transfer news right now</p>
      </section>
    );
  }
  const [lead, ...rest] = articles;

  return (
    <section className="rounded-card border border-hairline bg-card p-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-cardtitle text-text-primary">Transfer Talk</h3>
        <Link href="/news?tag=transfers" className="text-[12px] font-semibold text-text-secondary hover:text-text-primary">
          See all
        </Link>
      </div>

      <a href={lead.sourceUrl} target="_blank" rel="noopener noreferrer" className="group block">
        <div className="flex items-start gap-3">
          {lead.image ? (
            <div
              aria-hidden
              className="h-16 w-16 shrink-0 overflow-hidden rounded-tile bg-cover bg-center"
              style={{ backgroundImage: `url(${lead.image})` }}
            />
          ) : (
            <MediaPlaceholder className="h-16 w-16 shrink-0 rounded-tile" />
          )}
          <div className="min-w-0">
            <span className="rounded-full bg-accent-lime-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-lime">
              Transfers
            </span>
            <p className="mt-1.5 line-clamp-3 text-meta font-semibold text-text-primary group-hover:text-accent-lime">
              {lead.title}
            </p>
            <p className="mt-0.5 text-[11px] text-text-muted">
              {lead.sourceName} · {timeAgo(lead.publishedAtUtc)}
            </p>
          </div>
        </div>
      </a>

      {rest.length > 0 && (
        <ul className="mt-3 divide-y divide-hairline border-t border-hairline">
          {rest.slice(0, 2).map((a) => (
            <li key={a.id}>
              <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer" className="block py-2.5">
                <p className="line-clamp-2 text-meta font-medium text-text-primary hover:text-accent-lime">{a.title}</p>
                <p className="mt-0.5 text-[11px] text-text-muted">
                  {a.sourceName} · {timeAgo(a.publishedAtUtc)}
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
