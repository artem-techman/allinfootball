"use client";

import { useState } from "react";

/**
 * Team/competition crest. Crests come from the data API's logo URLs (legally
 * clean — CLAUDE.md section 11).
 *
 * Reliability: loaded as a plain <img> straight from the CDN (media.api-sports.io
 * is fast and reliable; Next's optimizer intermittently failed to fetch the ~30
 * distinct World Cup flags at once). `crossOrigin="anonymous"` makes the browser
 * cache a CORS-clean copy — required so the bracket can be captured to a canvas
 * for the Share feature (the CDN sends `access-control-allow-origin: *`). A load
 * error falls back to the neutral monogram, so a crest never renders blank.
 */
export function Crest({
  src,
  name,
  size = 24,
}: {
  src?: string;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    const initials = name.slice(0, 2).toUpperCase();
    return (
      <span
        aria-label={name}
        role="img"
        style={{ width: size, height: size }}
        className="grid shrink-0 place-items-center rounded-full bg-hairline text-[10px] font-semibold text-text-secondary"
      >
        {initials}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${name} crest`}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      crossOrigin="anonymous"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="shrink-0 object-contain"
    />
  );
}
