/** Loading placeholder. Every data section shows a skeleton, never a blank flash
 * (CLAUDE.md section 10). Uses a subtle hairline-toned shimmer. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-live-pulse rounded-tile bg-hairline/80 ${className}`}
      aria-hidden
    />
  );
}
