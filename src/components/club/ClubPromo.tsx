"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRightIcon } from "@/components/primitives/icons";

/** Clubs the promo cycles through — big names across our competitions. */
const CLUBS = [
  { id: 42, name: "Arsenal" },
  { id: 541, name: "Real Madrid" },
  { id: 157, name: "Bayern" },
  { id: 40, name: "Liverpool" },
  { id: 529, name: "Barcelona" },
  { id: 505, name: "Inter" },
  { id: 85, name: "PSG" },
  { id: 50, name: "Man City" },
  { id: 496, name: "Juventus" },
  { id: 9568, name: "Inter Miami" },
  { id: 33, name: "Man United" },
  { id: 165, name: "Dortmund" },
];
const crest = (id: number) => `https://media.api-sports.io/football/teams/${id}.png`;
const EVERY_MS = 2000;

/**
 * "Follow your club" — shown on home until a club is picked. A crest carousel
 * (one club every 2s, neighbours ghosted either side) and the club's name in
 * the copy make the point at a glance: pick YOUR team. Static under
 * prefers-reduced-motion.
 */
export function ClubPromo() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (!document.hidden) setI((n) => (n + 1) % CLUBS.length);
    }, EVERY_MS);
    return () => clearInterval(t);
  }, []);
  const club = CLUBS[i];
  const prev = CLUBS[(i - 1 + CLUBS.length) % CLUBS.length];
  const next = CLUBS[(i + 1) % CLUBS.length];

  return (
    <Link href="/my-club" className="group block rounded-card mft-gradient-border p-[1.5px] shadow-soft">
      <div className="relative flex items-center gap-4 overflow-hidden rounded-[15px] bg-card px-4 py-4">
        {/* soft brand glow behind the crest */}
        <div aria-hidden className="pointer-events-none absolute -left-10 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(91,200,80,0.22),transparent_65%)]" />

        {/* crest carousel */}
        <div aria-hidden className="relative h-[68px] w-[92px] shrink-0">
          <Ghost id={prev.id} side="left" />
          <Ghost id={next.id} side="right" />
          <div className="absolute left-1/2 top-1/2 grid h-[60px] w-[60px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-card-2 shadow-[0_0_0_1.5px_rgba(205,242,74,0.55),0_6px_18px_rgba(0,0,0,0.45)]">
            <Image key={club.id} src={crest(club.id)} alt="" width={38} height={38} className="h-[38px] w-[38px] animate-crest-in object-contain motion-reduce:animate-none" />
          </div>
        </div>

        <div className="relative min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
            <span key={club.id} className="inline-block animate-word-in text-accent-lime motion-reduce:animate-none">{club.name}</span> fan?
          </p>
          <p className="mt-0.5 text-cardtitle text-text-primary">Follow your club</p>
          <p className="mt-0.5 text-[12px] leading-snug text-text-secondary">Next match, results and table in one place.</p>
        </div>

        <span className="relative hidden shrink-0 items-center gap-1 rounded-full bg-accent-gradient px-3 py-1.5 text-[12px] font-bold text-text-on-accent transition-transform group-hover:translate-x-0.5 min-[380px]:inline-flex">
          Pick
          <ChevronRightIcon size={14} />
        </span>
      </div>
    </Link>
  );
}

function Ghost({ id, side }: { id: number; side: "left" | "right" }) {
  return (
    <Image
      key={`${side}-${id}`}
      src={crest(id)}
      alt=""
      width={26}
      height={26}
      className={`absolute top-1/2 h-[26px] w-[26px] -translate-y-1/2 animate-word-in object-contain opacity-35 grayscale-[30%] motion-reduce:animate-none ${side === "left" ? "left-0" : "right-0"}`}
    />
  );
}
