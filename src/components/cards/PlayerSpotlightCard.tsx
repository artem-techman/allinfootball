import Link from "next/link";
import { ArrowRightIcon, CheckIcon } from "@/components/primitives/icons";

/**
 * Player spotlight card (dark reference): dark card with a 42-Electric purple
 * panel behind a right-aligned player cutout, the name + verified tick,
 * "Club · Position", a 3-column stat strip (Matches, Goals, Assists) and a white
 * "View Profile" button. Falls back to a gradient silhouette when no photo.
 */
export function PlayerSpotlightCard({
  name,
  href,
  club,
  position,
  verified = false,
  matches,
  goals,
  assists,
  portraitUrl,
}: {
  name: string;
  href: string;
  club: string;
  position?: string;
  verified?: boolean;
  matches?: number;
  goals?: number;
  assists?: number;
  portraitUrl?: string;
}) {
  const meta = [club, position].filter(Boolean).join(" · ");
  return (
    <section className="relative flex h-full min-h-[300px] flex-col overflow-hidden rounded-card border border-hairline bg-card p-card text-text-on-dark">
      {/* purple panel behind the cutout */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-2 h-[62%] w-[58%]"
        style={{
          background:
            "radial-gradient(75% 80% at 75% 25%, rgba(90,56,255,0.55) 0%, rgba(90,56,255,0.15) 50%, rgba(19,20,25,0) 75%)",
        }}
      />
      {/* player cutout (transparent PNG) or gradient silhouette */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[96px] right-0 h-[58%] w-[52%]"
        style={{
          background: portraitUrl
            ? `bottom right/contain no-repeat url(${portraitUrl})`
            : "linear-gradient(160deg, rgba(90,56,255,0.4), rgba(19,20,25,0))",
        }}
      />

      <div className="relative mb-2 flex items-center justify-between">
        <h3 className="text-cardtitle">Player Spotlight</h3>
        <Link href={href} className="text-[12px] font-semibold text-text-on-dark-dim hover:text-text-on-dark">
          See all
        </Link>
      </div>

      <div className="relative mt-auto">
        <div className="flex items-center gap-1.5">
          <h4 className="text-section">{name}</h4>
          {verified && (
            <span aria-label="Verified" className="grid h-4 w-4 place-items-center rounded-full bg-accent-electric text-white">
              <CheckIcon size={10} />
            </span>
          )}
        </div>
        <p className="mt-0.5 text-meta text-text-on-dark-dim">{meta}</p>

        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-hairline pt-3">
          <Stat label="Matches" value={matches} />
          <Stat label="Goals" value={goals} />
          <Stat label="Assists" value={assists} />
        </div>

        <Link
          href={href}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-tile bg-white py-2.5 text-meta font-semibold text-text-on-accent transition-transform duration-200 hover:-translate-y-0.5"
        >
          View Profile <ArrowRightIcon size={15} />
        </Link>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="text-center">
      <div className="tabular text-[20px] font-bold leading-none">{value ?? "-"}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wide text-text-on-dark-dim">{label}</div>
    </div>
  );
}
