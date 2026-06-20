"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ComponentProps } from "react";
import { HeroFeatureCard } from "./HeroFeatureCard";

type SlideProps = Omit<ComponentProps<typeof HeroFeatureCard>, "dots">;

const INTERVAL_MS = 5000;

export function HeroCarousel({ slides }: { slides: SlideProps[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const count = slides.length;

  const prev = useCallback(() => setActive((i) => (i - 1 + count) % count), [count]);
  const next = useCallback(() => setActive((i) => (i + 1) % count), [count]);

  useEffect(() => {
    if (paused || count <= 1) return;
    const id = setInterval(next, INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused, next, count, active]);

  if (count === 0) return null;
  if (count === 1) return <HeroFeatureCard {...slides[0]} dots={0} />;

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* sliding track — outer clip with matching radius */}
      <div className="overflow-hidden rounded-[28px]">
        <div
          className="flex transition-transform duration-500 ease-out-soft"
          style={{ transform: `translateX(-${active * 100}%)` }}
          onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const delta = e.changedTouches[0].clientX - touchStartX.current;
            if (delta < -40) next();
            else if (delta > 40) prev();
            touchStartX.current = null;
          }}
        >
          {slides.map((slide, i) => (
            <div key={i} className="w-full flex-shrink-0">
              <HeroFeatureCard {...slide} dots={0} />
            </div>
          ))}
        </div>
      </div>

      {/* prev arrow */}
      <button
        type="button"
        onClick={prev}
        aria-label="Previous story"
        className="absolute left-3 top-1/2 z-20 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-[22px] font-light text-white backdrop-blur transition-colors hover:bg-black/60"
      >
        ‹
      </button>

      {/* next arrow */}
      <button
        type="button"
        onClick={next}
        aria-label="Next story"
        className="absolute right-3 top-1/2 z-20 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-[22px] font-light text-white backdrop-blur transition-colors hover:bg-black/60"
      >
        ›
      </button>

      {/* dot navigation */}
      <div className="absolute bottom-6 right-6 z-10 flex items-center gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to story ${i + 1}`}
            onClick={() => setActive(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === active ? "w-4 bg-accent-lime" : "w-1.5 bg-white/30 hover:bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
