"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { getCompetitionBySlug } from "@/lib/constants/competitions";
import { LocalTime } from "@/components/primitives/LocalTime";
import type { Highlight } from "@/lib/highlights";

/**
 * Instagram/Reels-style highlights feed. A vertical snap-scroll column where the
 * clip in view autoplays (muted, per browser policy) and the others pause; tap to
 * play/pause via YouTube's controls, one button to unmute. Clips come from
 * official YouTube channels and are EMBEDDED (never re-hosted — CLAUDE.md §17);
 * channels that block off-site embedding fall back to a tap-to-open poster so the
 * feed never shows a broken player.
 */

const MUTE_KEY = "myfootballtracker.reel.muted.v1";

function embedSrc(id: string, muted: boolean): string {
  const p = new URLSearchParams({
    autoplay: "1",
    mute: muted ? "1" : "0",
    playsinline: "1",
    controls: "1",
    rel: "0",
    modestbranding: "1",
    enablejsapi: "1",
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${p.toString()}`;
}

/** Fire a YouTube IFrame API command over postMessage (needs enablejsapi=1). */
function cmd(iframe: HTMLIFrameElement | null, func: "mute" | "unMute" | "playVideo" | "pauseVideo") {
  iframe?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
}

export function HighlightReel({ highlights }: { highlights: Highlight[] }) {
  const PAGE = 20;
  const [slug, setSlug] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE);
  // Reduced motion or Data Saver: nothing plays until tapped.
  const [autoplay, setAutoplay] = useState(true);
  const autoplayRef = useRef(true);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (reduce || saveData) {
      autoplayRef.current = false;
      setAutoplay(false);
      setActiveId(null);
    }
  }, []);

  const listRef = useRef<HTMLDivElement>(null);
  const activeIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Restore the viewer's mute preference.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(MUTE_KEY) === "false") setMuted(false);
    } catch {
      /* ignore */
    }
  }, []);

  const chips = useMemo(() => {
    const slugs = [...new Set(highlights.map((h) => h.competitionSlug).filter(Boolean))] as string[];
    return slugs
      .map((s) => getCompetitionBySlug(s))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
  }, [highlights]);

  const shown = useMemo(
    () => (slug ? highlights.filter((h) => h.competitionSlug === slug) : highlights),
    [slug, highlights],
  );

  // Track which card is in view within the PAGE viewport (root: null). The
  // most-visible card autoplays; the others stay posters. Re-runs when the list
  // or the revealed count changes so newly shown cards get observed.
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const ratios = new Map<string, number>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.id;
          if (id) ratios.set(id, e.isIntersecting ? e.intersectionRatio : 0);
        }
        let bestId: string | null = null;
        let best = 0;
        ratios.forEach((r, id) => {
          if (r > best) {
            best = r;
            bestId = id;
          }
        });
        if (bestId && autoplayRef.current) setActiveId(bestId);
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }, // root: null = the page viewport
    );
    root.querySelectorAll("[data-id]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [shown, visible]);

  // Reset to the first page/clip when the filter changes.
  useEffect(() => {
    setVisible(PAGE);
    setActiveId(autoplayRef.current ? shown[0]?.id ?? null : null);
  }, [slug, shown]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try {
        window.localStorage.setItem(MUTE_KEY, String(next));
      } catch {
        /* ignore */
      }
      cmd(activeIframeRef.current, next ? "mute" : "unMute");
      return next;
    });
  }, []);

  if (shown.length === 0) {
    return <p className="py-16 text-center text-meta text-text-secondary">No highlights available right now.</p>;
  }

  return (
    <div className="flex flex-col">
      {chips.length > 1 && (
        <div className="mb-3 flex gap-2 overflow-x-auto overflow-y-hidden pb-1">
          <Chip active={slug === null} onClick={() => setSlug(null)}>
            All
          </Chip>
          {chips.map((c) => (
            <Chip key={c.slug} active={slug === c.slug} onClick={() => setSlug(c.slug)}>
              {c.name}
            </Chip>
          ))}
        </div>
      )}

      {/* Normal page flow: the feed scrolls with the page, so the footer sits
          naturally below. First 20 clips, then "View more". */}
      <div ref={listRef} className="mx-auto flex w-full max-w-[460px] flex-col gap-4">
        {shown.slice(0, visible).map((h) => (
          <ReelCard
            key={h.id}
            highlight={h}
            active={h.id === activeId}
            onActivate={() => setActiveId(h.id)}
            tapToPlay={!autoplay}
            muted={muted}
            onToggleMute={toggleMute}
            registerActiveIframe={(el) => {
              if (h.id === activeId) activeIframeRef.current = el;
            }}
          />
        ))}

        {visible < shown.length && (
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE)}
            className="mx-auto mt-1 rounded-full border border-hairline bg-card px-5 py-2.5 text-meta font-semibold text-text-primary transition-colors hover:border-accent-lime hover:text-accent-lime"
          >
            View more highlights
          </button>
        )}
      </div>
    </div>
  );
}

function ReelCard({
  highlight: h,
  active,
  onActivate,
  tapToPlay,
  muted,
  onToggleMute,
  registerActiveIframe,
}: {
  highlight: Highlight;
  active: boolean;
  onActivate: () => void;
  tapToPlay: boolean;
  muted: boolean;
  onToggleMute: () => void;
  registerActiveIframe: (el: HTMLIFrameElement | null) => void;
}) {
  const comp = h.competitionSlug ? getCompetitionBySlug(h.competitionSlug) : undefined;
  const canEmbed = h.embeddable !== false;
  const showPlayer = active && canEmbed;

  return (
    <section data-id={h.id} className="w-full shrink-0 snap-start">
      {/* a natural 16:9 card; the next one peeks below so the feed reads as a
          scrollable reel, and there's gutter around the player to scroll on */}
      <div className="relative overflow-hidden rounded-card bg-black shadow-soft">
        <div className="relative aspect-video w-full bg-black">
          {showPlayer ? (
            <iframe
              ref={registerActiveIframe}
              key={h.id}
              src={embedSrc(h.id, muted)}
              title={h.title}
              className="absolute inset-0 h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              loading="eager"
              onLoad={(e) => {
                // nudge playback (some browsers hold muted autoplay until asked)
                // and honour an existing unmute preference once the player is up
                cmd(e.currentTarget, "playVideo");
                if (!muted) cmd(e.currentTarget, "unMute");
              }}
            />
          ) : (
            <a
              href={h.watchUrl}
              target={canEmbed ? undefined : "_blank"}
              rel="noopener noreferrer"
              aria-label={canEmbed ? h.title : `Watch on YouTube: ${h.title}`}
              className="group absolute inset-0 block"
              onClick={(ev) => {
                // Embeddable but not yet active: play it here rather than leaving
                // the page (with autoplay off, a tap is the only way to start it).
                if (canEmbed) {
                  ev.preventDefault();
                  if (tapToPlay) onActivate();
                }
              }}
            >
              <Image src={h.thumbnailUrl} alt="" fill sizes="520px" className="object-cover" />
              <span className="absolute inset-0 grid place-items-center bg-black/30 transition-colors group-hover:bg-black/40">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-accent-gradient text-text-on-accent shadow-elevated">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </span>
              {!canEmbed && (
                <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  Watch on YouTube
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M7 17 17 7M9 7h8v8" />
                  </svg>
                </span>
              )}
            </a>
          )}
        </div>

        {/* overlay: competition chip + title/meta, Instagram-style */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-4 pt-10">
          {comp && (
            <span className="mb-1.5 inline-flex w-fit items-center rounded-full bg-accent-lime-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-lime">
              {comp.name}
            </span>
          )}
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-white">{h.title}</h3>
          <p className="mt-1 flex items-center gap-2 text-[11px] text-white/70">
            <span>{h.channelTitle}</span>
            <span aria-hidden>·</span>
            <LocalTime iso={h.publishedAtUtc} mode="date" />
            <a
              href={h.watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto ml-auto inline-flex items-center gap-1 font-semibold text-white/85 hover:text-white"
            >
              YouTube
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </a>
          </p>
        </div>

        {/* mute toggle — only meaningful while a player is active */}
        {showPlayer && (
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
          >
            {muted ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M11 5 6 9H2v6h4l5 4V5z" />
                <path d="m23 9-6 6M17 9l6 6" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M11 5 6 9H2v6h4l5 4V5z" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
              </svg>
            )}
          </button>
        )}
      </div>
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-meta font-semibold transition-colors ${
        active
          ? "border-accent-lime bg-accent-gradient text-text-on-accent"
          : "border-hairline bg-card text-text-secondary hover:border-white/15 hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}
