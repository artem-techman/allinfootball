import Link from "next/link";

/**
 * All In Football wordmark: a lime rounded-square mark carrying a dark "AIF"
 * monogram, followed by the wordmark "All In Football". This is the ONLY brand
 * mark in the app — the reference's "FUTBOLY" name is a design reference only and
 * is never rendered (same rule as the original "PitchLine" mockup).
 */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="All In Football home"
      className="inline-flex items-center gap-2.5"
    >
      <span
        aria-hidden
        className="grid h-9 w-9 place-items-center rounded-tile bg-accent-lime text-[12px] font-extrabold leading-none tracking-tight text-text-on-accent"
      >
        AIF
      </span>
      {!compact && (
        <span className="text-[16px] font-bold tracking-[-0.01em] text-text-primary">
          All In Football
        </span>
      )}
    </Link>
  );
}
