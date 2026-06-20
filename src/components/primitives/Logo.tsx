import Link from "next/link";
import { BallMark } from "./BallMark";

/**
 * Good Football Company lockup: the hexagonal football mark, then the wordmark
 * stacked in three uppercase lines (matching the brand lockup), separated by a
 * thin divider. `compact` renders the mark only (collapsed sidebar / tight bars).
 */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Good Football Company home"
      className="inline-flex items-center gap-2.5 text-text-primary"
    >
      <BallMark className="h-9 w-9 shrink-0" />
      {!compact && (
        <>
          <span aria-hidden className="h-8 w-px shrink-0 bg-hairline" />
          <span className="text-[11px] font-extrabold uppercase leading-[1.15] tracking-[0.02em] text-text-primary">
            Good
            <br />
            Football
            <br />
            Company
          </span>
        </>
      )}
    </Link>
  );
}
