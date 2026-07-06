"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Team/competition crest. Crests come from the data API's logo URLs (legally
 * clean — CLAUDE.md section 11).
 *
 * Reliability: the tiny CDN icons are served `unoptimized` (loaded straight from
 * media.api-sports.io rather than through Next's image optimizer, which
 * intermittently failed to fetch the ~30 distinct World Cup flags at once and
 * left blank icons). And a load error — a genuine 404 or a network blip — falls
 * back to the neutral monogram, so a crest never renders as a broken/blank box.
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
    <Image
      src={src}
      alt={`${name} crest`}
      width={size}
      height={size}
      unoptimized
      onError={() => setFailed(true)}
      className="shrink-0 object-contain"
    />
  );
}
