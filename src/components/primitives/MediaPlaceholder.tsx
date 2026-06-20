import { BallMark } from "./BallMark";

/**
 * Minimal, on-brand image fallback (used when a news/feed item has no image).
 * A flat dark surface with the faint Good Football Company mark centred —
 * intentionally simple, no gradients or stock photos. Render it as a positioned
 * fill, or with its own size via className.
 */
export function MediaPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`grid place-items-center bg-card-2 ${className}`}>
      <BallMark className="h-8 w-8 text-text-muted opacity-50" />
    </div>
  );
}
