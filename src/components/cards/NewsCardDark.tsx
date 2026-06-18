import Link from "next/link";
import { timeAgo } from "@/lib/utils/date";

/**
 * Dark news card (CLAUDE.md section 12): dark card, rounded thumbnail on the
 * left, white headline, dim meta time. Link-out only in v1 — no article body.
 */
export function NewsCardDark({
  title,
  href,
  sourceName,
  publishedAtUtc,
  image,
}: {
  title: string;
  href: string;
  sourceName: string;
  publishedAtUtc: string;
  image?: string;
}) {
  return (
    <Link
      href={href}
      className="flex h-full items-start gap-3 rounded-card border border-hairline bg-card p-card text-text-on-dark transition-transform duration-200 hover:-translate-y-0.5"
    >
      <div
        aria-hidden
        className="h-16 w-16 shrink-0 overflow-hidden rounded-tile"
        style={{
          background: image
            ? `center/cover no-repeat url(${image})`
            : "linear-gradient(135deg, var(--surface-dark-2), #2b2f36)",
        }}
      />
      <div className="min-w-0">
        <h3 className="line-clamp-3 text-cardtitle leading-snug">{title}</h3>
        <p className="mt-2 text-meta text-text-on-dark-dim">
          {sourceName} · {timeAgo(publishedAtUtc)}
        </p>
      </div>
    </Link>
  );
}
