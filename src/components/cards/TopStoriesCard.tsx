import Link from "next/link";
import { timeAgo } from "@/lib/utils/date";

export interface StoryItem {
  id: string;
  title: string;
  href: string;
  publishedAtUtc: string;
  image?: string;
  tag?: string;
}

/**
 * Top Stories card (dark reference): a large featured story with an overlaid tag
 * + headline on the left, and a list of secondary headlines with thumbnails on
 * the right. Link-out only in v1 (news bodies are never stored). Falls back to a
 * gradient when a story has no image.
 */
export function TopStoriesCard({
  featured,
  items,
}: {
  featured: StoryItem;
  items: StoryItem[];
}) {
  return (
    <section className="flex h-full flex-col rounded-card border border-hairline bg-card p-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-cardtitle text-text-primary">Top Stories</h3>
        <Link href="/news" className="text-[12px] font-semibold text-text-secondary hover:text-text-primary">
          See all
        </Link>
      </div>

      <div className="grid flex-1 gap-4 sm:grid-cols-[1.15fr_1fr]">
        {/* featured */}
        <Link href={featured.href} className="group relative min-h-[260px] overflow-hidden rounded-tile">
          <div
            aria-hidden
            className="absolute inset-0 transition-transform duration-300 group-hover:scale-[1.03]"
            style={{
              background: featured.image
                ? `center/cover no-repeat url(${featured.image})`
                : "linear-gradient(150deg, #1a1730 0%, #131419 60%)",
            }}
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
          <div className="relative flex h-full flex-col justify-end p-4">
            {featured.tag && (
              <span className="mb-2 inline-flex w-fit items-center rounded-full bg-accent-gradient px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-text-on-accent">
                {featured.tag}
              </span>
            )}
            <h4 className="text-[21px] font-bold leading-tight text-text-on-dark">{featured.title}</h4>
            <p className="mt-1.5 text-[11px] text-text-on-dark-dim">{timeAgo(featured.publishedAtUtc)}</p>
          </div>
        </Link>

        {/* list */}
        <ul className="flex flex-col divide-y divide-hairline">
          {items.slice(0, 4).map((s) => (
            <li key={s.id} className="flex-1">
              <Link href={s.href} className="flex h-full items-center gap-3 py-2.5">
                <div
                  aria-hidden
                  className="h-14 w-14 shrink-0 overflow-hidden rounded-tile"
                  style={{
                    background: s.image
                      ? `center/cover no-repeat url(${s.image})`
                      : "linear-gradient(135deg, #1f2128, #2a2d36)",
                  }}
                />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-body font-medium leading-snug text-text-primary">{s.title}</p>
                  <p className="mt-1 text-[11px] text-text-secondary">{timeAgo(s.publishedAtUtc)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
