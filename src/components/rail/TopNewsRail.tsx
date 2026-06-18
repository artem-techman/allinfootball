import Link from "next/link";
import { timeAgo } from "@/lib/utils/date";

export interface TopNewsItem {
  id: string;
  title: string;
  href: string;
  sourceName: string;
  publishedAtUtc: string;
  image?: string;
}

/**
 * Top News rail (CLAUDE.md section 12): a lead image card with overlaid headline
 * and meta, then one or two text headlines. News is link-out only in v1
 * (section 11). Renders an empty note when the river is empty.
 */
export function TopNewsRail({ items }: { items: TopNewsItem[] }) {
  if (items.length === 0) {
    return (
      <section className="rounded-card border border-hairline bg-card p-card">
        <h3 className="mb-2 text-cardtitle text-text-primary">Top News</h3>
        <p className="py-3 text-center text-meta text-text-secondary">No news yet</p>
      </section>
    );
  }
  const [lead, ...rest] = items;
  return (
    <section className="rounded-card border border-hairline bg-card p-card">
      <h3 className="mb-3 text-cardtitle text-text-primary">Top News</h3>

      <Link href={lead.href} className="block overflow-hidden rounded-tile">
        <div
          className="relative flex min-h-[140px] flex-col justify-end p-3"
          style={{
            background: lead.image
              ? `center/cover no-repeat url(${lead.image})`
              : "linear-gradient(135deg, var(--surface-dark), var(--surface-dark-2))",
          }}
        >
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-surface-dark/85 to-transparent" />
          <div className="relative">
            <p className="line-clamp-2 text-cardtitle text-text-on-dark">{lead.title}</p>
            <p className="mt-1 text-[11px] text-text-on-dark-dim">
              {lead.sourceName} · {timeAgo(lead.publishedAtUtc)}
            </p>
          </div>
        </div>
      </Link>

      {rest.length > 0 && (
        <ul className="mt-3 divide-y divide-hairline">
          {rest.slice(0, 2).map((n) => (
            <li key={n.id}>
              <Link href={n.href} className="block py-2.5">
                <p className="line-clamp-2 text-meta font-semibold text-text-primary">{n.title}</p>
                <p className="mt-0.5 text-[11px] text-text-secondary">
                  {n.sourceName} · {timeAgo(n.publishedAtUtc)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
