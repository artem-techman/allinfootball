/**
 * Small, non-blocking "Data may be delayed" banner shown when the provider is
 * degraded (429/5xx) and we're serving last-good cache (CLAUDE.md section 10).
 * Never replaces the page — it sits above the stale content.
 */
export function ErrorBanner({
  message = "Data may be delayed",
}: {
  message?: string;
}) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-tile border border-hairline bg-card px-3 py-2 text-meta text-text-secondary"
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full bg-live-red"
      />
      {message}
    </div>
  );
}
