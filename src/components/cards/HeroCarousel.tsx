"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ComponentProps } from "react";
import { HeroFeatureCard } from "./HeroFeatureCard";
import { PauseIcon, PlayIcon } from "@/components/primitives/icons";

type SlideProps = Omit<ComponentProps<typeof HeroFeatureCard>, "dots">;

const INTERVAL_MS = 5000;

/**
 * Home hero carousel. Accessibility (B18, WCAG 2.2.2): a visible pause/play
 * control; no auto-rotation under prefers-reduced-motion (the viewer can still
 * press play); rotation also pauses on hover and while focus is inside; and
 * off-screen slides are `inert` + aria-hidden so keyboard and screen-reader
 * users only ever reach the visible story.
 */
export function HeroCarousel({ slides }: { slides: SlideProps[] }) {
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // null = follow the motion preference; true/false once the viewer presses the button.
  const [playChoice, setPlayChoice] = useState<boolean | null>(null);
  // null until read after mount, so nothing rotates before we know the preference.
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const touchStartX = useRef<number | null>(null);
  const count = slides.length;

  const prev = useCallback(() => setActive((i) => (i - 1 + count) % count), [count]);
  const next = useCallback(() => setActive((i) => (i + 1) % count), [count]);

  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    } catch {
      setReducedMotion(false);
      return;
    }
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  const playing = playChoice ?? reducedMotion === false;
  const rotating = playing && !hovered && !focused && count > 1;

  useEffect(() => {
    if (!rotating) return;
    const id = setInterval(next, INTERVAL_MS);
    return () => clearInterval(id);
  }, [rotating, next, active]);

  if (count === 0) return null;
  if (count === 1) return <HeroFeatureCard {...slides[0]} dots={0} />;

  return (
    <section
      className="relative"
      aria-roledescription="carousel"
      aria-label="Top stories"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      {/* sliding track — outer clip with matching radius */}
      <div className="overflow-hidden rounded-[28px]">
        <div
          aria-live={rotating ? "off" : "polite"}
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
            <div
              key={i}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={i !== active}
              inert={i !== active}
              className="w-full flex-shrink-0"
            >
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

      {/* pause/play + dot navigation */}
      <div className="absolute bottom-5 right-6 z-10 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setPlayChoice(!playing)}
          aria-label={playing ? "Pause story rotation" : "Play story rotation"}
          className="mr-1 grid h-7 w-7 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60"
        >
          {playing ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
        </button>
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to story ${i + 1}`}
            aria-current={i === active ? "true" : undefined}
            onClick={() => setActive(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === active ? "w-4 bg-accent-gradient" : "w-1.5 bg-white/30 hover:bg-white/50"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
