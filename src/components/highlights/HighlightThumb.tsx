import Image from "next/image";

/**
 * Highlight thumbnail that opens the clip on YouTube in a new tab. Official
 * channels (FIFA et al.) block off-site embedding, so rather than render a player
 * that gets blocked, we link straight to the video on YouTube.
 */
export function HighlightThumb({
  title,
  thumbnailUrl,
  watchUrl,
}: {
  title: string;
  thumbnailUrl: string;
  watchUrl: string;
}) {
  return (
    <a
      href={watchUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Watch on YouTube: ${title}`}
      className="group relative block aspect-video w-full overflow-hidden rounded-tile bg-black"
    >
      <Image src={thumbnailUrl} alt="" fill sizes="(max-width: 640px) 100vw, 400px" className="object-cover" />

      {/* play button */}
      <span className="absolute inset-0 grid place-items-center bg-black/25 transition-colors group-hover:bg-black/35">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-accent-gradient text-text-on-accent shadow-elevated transition-transform group-hover:scale-105">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>

      {/* opens-in-YouTube affordance */}
      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        Watch on YouTube
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 17 17 7M9 7h8v8" />
        </svg>
      </span>
    </a>
  );
}
