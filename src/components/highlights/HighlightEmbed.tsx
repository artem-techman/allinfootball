"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * Lightweight YouTube embed. Shows the thumbnail with a play button and only
 * loads the (privacy-friendly youtube-nocookie) iframe once the user clicks —
 * so visiting a page with many clips doesn't pull dozens of heavy players.
 */
export function HighlightEmbed({
  title,
  thumbnailUrl,
  embedUrl,
}: {
  title: string;
  thumbnailUrl: string;
  embedUrl: string;
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-tile bg-black">
      {playing ? (
        <iframe
          src={`${embedUrl}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play highlights: ${title}`}
          className="group absolute inset-0"
        >
          <Image
            src={thumbnailUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 400px"
            className="object-cover"
          />
          <span className="absolute inset-0 grid place-items-center bg-black/25 transition-colors group-hover:bg-black/35">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-accent-gradient text-text-on-accent shadow-elevated transition-transform group-hover:scale-105">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
