/**
 * Minimal, on-brand image fallback (used when a news/feed item has no image).
 * A flat dark surface with the faint lime "AIF" mark centred — intentionally
 * simple, no gradients or stock photos. Render it as a positioned fill, or with
 * its own size via className.
 */
export function MediaPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`grid place-items-center bg-card-2 ${className}`}>
      <span className="grid h-7 w-7 place-items-center rounded-[7px] bg-accent-lime-soft text-[9px] font-extrabold leading-none tracking-tight text-accent-lime">
        AIF
      </span>
    </div>
  );
}
