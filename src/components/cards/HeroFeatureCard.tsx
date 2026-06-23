import Link from "next/link";
import { Crest } from "@/components/primitives/Crest";
import { ArrowRightIcon } from "@/components/primitives/icons";

export interface HeroScore {
  compLabel: string;
  homeName: string;
  awayName: string;
  homeCrest?: string;
  awayCrest?: string;
  homeScore?: number;
  awayScore?: number;
  statusLabel: string;
}

/**
 * Hero feature card (dark reference). A full-bleed match photo with a dark
 * left-side scrim for legibility and a 42-Electric purple glow on the right; an
 * editorial headline whose emphasis word is rendered in 42-Lime; a dek; a white
 * "Match Report" button with an arrow chip; a faded home-crest watermark; a
 * centered-bottom glass score chip; and carousel dots. Falls back to a premium
 * gradient when no photo is supplied (never a hardcoded copyrighted photo).
 */
export function HeroFeatureCard({
  tag,
  headline,
  headlineAccent,
  dek,
  href,
  ctaLabel = "Match Report",
  score,
  imageUrl,
  dots = 3,
}: {
  tag: string;
  headline: string;
  headlineAccent?: string;
  dek: string;
  href: string;
  ctaLabel?: string;
  score?: HeroScore;
  imageUrl?: string;
  dots?: number;
}) {
  return (
    <article className="relative min-h-[340px] overflow-hidden rounded-hero border border-hairline bg-surface-dark text-text-on-dark">
      {/* feature image or premium gradient canvas */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: imageUrl
            ? `center/cover no-repeat url(${imageUrl})`
            : "radial-gradient(120% 120% at 85% 30%, rgba(90,56,255,0.45) 0%, rgba(90,56,255,0.10) 35%, rgba(8,9,12,0) 60%), linear-gradient(120deg, #0b0c10 0%, #14121f 55%, #1b1430 100%)",
        }}
      />
      {/* left-side legibility scrim */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(8,9,12,0.94) 0%, rgba(8,9,12,0.75) 36%, rgba(8,9,12,0.25) 66%, rgba(8,9,12,0.05) 100%)",
        }}
      />
      {/* electric accent edge */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 top-1/4 h-64 w-64 rounded-full bg-accent-electric-soft blur-3xl"
      />
      {/* faded home-crest watermark behind the score chip */}
      {score?.homeCrest && (
        <div
          aria-hidden
          className="pointer-events-none absolute right-[26%] top-1/2 hidden h-44 w-44 -translate-y-1/2 opacity-[0.12] md:block"
          style={{ background: `center/contain no-repeat url(${score.homeCrest})` }}
        />
      )}

      <div className="relative flex min-h-[340px] flex-col justify-between p-7 md:max-w-[56%]">
        <div>
          <span className="inline-flex items-center rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-text-on-dark backdrop-blur">
            {tag}
          </span>
          <h2 className="mt-5 line-clamp-3 text-[32px] font-bold leading-[1.08] tracking-[-0.02em]">
            <span>{headline}</span>
            {headlineAccent && <span className="text-accent-lime"> {headlineAccent}</span>}
          </h2>
          <p className="mt-3 line-clamp-2 max-w-md text-body text-text-on-dark-dim">{dek}</p>
        </div>

        <div className="mt-6">
          <Link
            href={href}
            className="inline-flex items-center gap-2.5 rounded-full bg-white py-1.5 pl-5 pr-1.5 text-meta font-semibold text-text-on-accent transition-transform duration-200 hover:-translate-y-0.5"
          >
            {ctaLabel}
            <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-dark text-text-on-dark">
              <ArrowRightIcon size={14} />
            </span>
          </Link>
        </div>
      </div>

      {/* centered-bottom score chip */}
      {score && (
        <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 md:left-[56%]">
          <div className="flex flex-col items-center rounded-lg2 border border-white/10 bg-surface-dark-2/85 px-6 py-3 shadow-elevated backdrop-blur">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-on-dark-dim">
              {score.compLabel}
            </span>
            <div className="mt-1.5 flex items-center gap-4">
              <Crest src={score.homeCrest} name={score.homeName} size={26} />
              <span className="tabular text-[26px] font-bold leading-none">
                {score.homeScore ?? "-"}
                <span className="px-2 text-text-on-dark-dim">-</span>
                {score.awayScore ?? "-"}
              </span>
              <Crest src={score.awayCrest} name={score.awayName} size={26} />
            </div>
            <div className="mt-1.5 flex items-center gap-5 text-[10px] font-medium text-text-on-dark-dim">
              <span className="w-20 text-center">{score.homeName}</span>
              <span className="uppercase tracking-wide text-text-on-dark">{score.statusLabel}</span>
              <span className="w-20 text-center">{score.awayName}</span>
            </div>
          </div>
        </div>
      )}

      {/* carousel dots */}
      {dots > 0 && (
        <div className="absolute bottom-6 right-6 z-10 flex items-center gap-1.5">
          {Array.from({ length: dots }).map((_, i) => (
            <span
              key={i}
              aria-hidden
              className={`h-1.5 rounded-full transition-all ${
                i === 0 ? "w-4 bg-accent-gradient" : "w-1.5 bg-white/30"
              }`}
            />
          ))}
        </div>
      )}
    </article>
  );
}
