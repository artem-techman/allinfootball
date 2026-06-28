"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { Match } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";
import { TrophyIcon, ChevronRightIcon } from "@/components/primitives/icons";

export interface BracketRound {
  name: string;
  matches: Match[];
}

/**
 * The full knockout skeleton, outermost → Final. We always render every slot of
 * every round (16 → 8 → 4 → 2 → 1) even when the teams aren't known yet, so the
 * shape of the draw is visible from the group stage onward. `label` uses the
 * European fraction notation the way the rounds are commonly named.
 */
const SKELETON = [
  { name: "Round of 32", label: "1/16", total: 16 },
  { name: "Round of 16", label: "1/8", total: 8 },
  { name: "Quarter-finals", label: "1/4", total: 4 },
  { name: "Semi-finals", label: "1/2", total: 2 },
] as const;

/** Height of the matches area when docked in the card; every column shares it so
 *  justify-around lines each match up with the centre of its two feeders. In
 *  full screen this grows to fill the viewport. */
const DOCKED_H = 432;

type Cell = { key: string; match: Match | null };
type Column = { label: string; side: "L" | "R"; round: number; cells: Cell[] };

export function WorldCupBracket({ rounds }: { rounds: BracketRound[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Record<string, HTMLElement | null>>({});
  const [paths, setPaths] = useState<string[]>([]);
  const [fits, setFits] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // left edge of the full-screen overlay = right edge of the sidebar (0 on
  // mobile, where the sidebar is collapsed), so the sidebar stays visible.
  const [sidebarRight, setSidebarRight] = useState(0);
  const [areaH, setAreaH] = useState(DOCKED_H);

  const register = useCallback((key: string, el: HTMLElement | null) => {
    cellRefs.current[key] = el;
  }, []);

  // ---- assemble the fixed skeleton, dropping real matches into their slots ----
  const slotsFor = (name: string, total: number): (Match | null)[] => {
    const provided = rounds.find((r) => r.name === name)?.matches ?? [];
    return Array.from({ length: total }, (_, i) => provided[i] ?? null);
  };

  const leftColumns: Column[] = SKELETON.map((s, round) => {
    const half = s.total / 2;
    return {
      label: s.label,
      side: "L" as const,
      round,
      cells: slotsFor(s.name, s.total)
        .slice(0, half)
        .map((match, i) => ({ key: `L-${round}-${i}`, match })),
    };
  });

  const rightColumns: Column[] = SKELETON.map((s, round) => {
    const half = s.total / 2;
    return {
      label: s.label,
      side: "R" as const,
      round,
      cells: slotsFor(s.name, s.total)
        .slice(half)
        .map((match, i) => ({ key: `R-${round}-${i}`, match })),
    };
  }).reverse(); // centre → outward: 1/2, 1/4, 1/8, 1/16

  const finalMatch = rounds.find((r) => r.name === "Final")?.matches[0] ?? null;

  // ---- draw the connectors by measuring the rendered card positions ----
  const recompute = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    const base = content.getBoundingClientRect();
    const box = (key: string) => {
      const el = cellRefs.current[key];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { l: r.left - base.left, r: r.right - base.left, y: r.top - base.top + r.height / 2 };
    };

    // child feeds parent: from the child's inner edge, elbow through the gap,
    // to the parent's outer edge. `side` is the side the children sit on.
    const elbow = (childKey: string, parentKey: string, side: "L" | "R"): string | null => {
      const c = box(childKey);
      const p = box(parentKey);
      if (!c || !p) return null;
      if (side === "L") {
        const midX = (c.r + p.l) / 2;
        return `M ${c.r} ${c.y} H ${midX} V ${p.y} H ${p.l}`;
      }
      const midX = (c.l + p.r) / 2;
      return `M ${c.l} ${c.y} H ${midX} V ${p.y} H ${p.r}`;
    };

    const out: (string | null)[] = [];
    // within each half, round r's match k is fed by round r-1's matches 2k & 2k+1
    for (const side of ["L", "R"] as const) {
      for (let round = 1; round < SKELETON.length; round++) {
        const parents = SKELETON[round].total / 2;
        for (let k = 0; k < parents; k++) {
          out.push(elbow(`${side}-${round - 1}-${2 * k}`, `${side}-${round}-${k}`, side));
          out.push(elbow(`${side}-${round - 1}-${2 * k + 1}`, `${side}-${round}-${k}`, side));
        }
      }
    }
    // the two semi-finals feed the Final
    out.push(elbow("L-3-0", "F", "L"));
    out.push(elbow("R-3-0", "F", "R"));

    setPaths(out.filter((p): p is string => p !== null));
    const sc = scrollRef.current;
    if (sc) setFits(sc.scrollWidth <= sc.clientWidth + 1);
  }, [rounds]);

  // re-measure connectors after layout, and whenever the size/mode changes
  // (entering full screen remounts the content into a portal).
  useLayoutEffect(() => {
    recompute();
    const content = contentRef.current;
    if (!content) return;
    const ro = new ResizeObserver(recompute);
    ro.observe(content);
    return () => ro.disconnect();
  }, [recompute, expanded, areaH]);

  // centre the horizontal scroll on the Final (when the tree overflows) so it
  // reads as symmetric; re-runs on mode/size change.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && !fits && el.scrollWidth > el.clientWidth + 1) {
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    }
  }, [fits, expanded, areaH]);

  // full-screen lifecycle: lock body scroll, grow the bracket to the viewport,
  // measure the sidebar so the overlay starts at its right edge, close on Esc.
  useEffect(() => {
    if (!expanded) {
      setAreaH(DOCKED_H);
      return;
    }
    const measure = () => {
      const sb = document.querySelector("[data-app-sidebar]");
      const r = sb?.getBoundingClientRect();
      setSidebarRight(r && r.width > 0 ? r.right : 0);
      setAreaH(Math.max(DOCKED_H, window.innerHeight - 180));
    };
    measure();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("resize", measure);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("resize", measure);
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  if (rounds.length === 0) return null;

  const board = (
    <div ref={scrollRef} className={`overflow-x-auto pb-1 ${fits ? "flex justify-center" : ""}`}>
      <div ref={contentRef} className="relative flex w-max items-stretch gap-[18px]">
        {/* connector overlay — sits behind the cards, in the same coordinate
            space as the content so it scrolls with it */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full text-text-muted" aria-hidden>
          {paths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeOpacity={0.6} />
          ))}
        </svg>

        {leftColumns.map((c) => (
          <BracketColumn key={`${c.side}-${c.round}`} column={c} areaH={areaH} register={register} />
        ))}
        <FinalColumn match={finalMatch} areaH={areaH} register={register} />
        {rightColumns.map((c) => (
          <BracketColumn key={`${c.side}-${c.round}`} column={c} areaH={areaH} register={register} />
        ))}
      </div>
    </div>
  );

  if (expanded && typeof document !== "undefined") {
    return createPortal(
      <div
        className="fixed inset-0 z-[60] flex flex-col bg-page"
        style={{ left: sidebarRight }}
        role="dialog"
        aria-modal="true"
        aria-label="World Cup knockout bracket"
      >
        <header className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <div>
            <h2 className="text-section text-text-primary">World Cup Knockouts</h2>
            <p className="mt-0.5 text-meta text-text-secondary">The full draw — scroll to explore both halves.</p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-[12px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
          >
            <CloseIcon size={14} /> Close
          </button>
        </header>
        <div className="flex min-h-0 flex-1 items-center px-5 py-4">{board}</div>
      </div>,
      document.body,
    );
  }

  return (
    <section className="rounded-card border border-hairline bg-card p-card">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-section text-text-primary">World Cup Knockouts</h2>
          <p className="mt-0.5 text-meta text-text-secondary">The road to the final — scroll to follow the bracket.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/competition/world-cup/fixtures"
            className="hidden items-center gap-1 text-[12px] font-semibold text-text-secondary hover:text-text-primary sm:flex"
          >
            Full schedule <ChevronRightIcon size={14} />
          </Link>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label="Open bracket full screen"
            className="flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-[12px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
          >
            <ExpandIcon size={14} /> Full screen
          </button>
        </div>
      </header>

      {board}
    </section>
  );
}

function ExpandIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function BracketColumn({
  column,
  areaH,
  register,
}: {
  column: Column;
  areaH: number;
  register: (key: string, el: HTMLElement | null) => void;
}) {
  return (
    <div className="relative z-10 flex w-[100px] shrink-0 flex-col">
      <div
        className={`mb-2 text-[10px] font-bold uppercase tracking-wide text-text-muted ${
          column.side === "L" ? "text-left" : "text-right"
        }`}
      >
        {column.label}
      </div>
      <div className="flex flex-col justify-around" style={{ height: areaH }}>
        {column.cells.map((cell) => (
          <MatchCard key={cell.key} match={cell.match} cellRef={(el) => register(cell.key, el)} />
        ))}
      </div>
    </div>
  );
}

function FinalColumn({
  match,
  areaH,
  register,
}: {
  match: Match | null;
  areaH: number;
  register: (key: string, el: HTMLElement | null) => void;
}) {
  return (
    <div className="relative z-10 flex w-[132px] shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-center gap-1 text-[11px] font-extrabold uppercase tracking-wide text-text-primary">
        <TrophyIcon size={13} /> Final
      </div>
      <div className="flex flex-col justify-around" style={{ height: areaH }}>
        <div ref={(el) => register("F", el)} className="rounded-tile bg-accent-gradient p-[2px] shadow-elevated">
          <div className="rounded-[10px] bg-card-2 p-2">
            {match ? (
              <Link href={`/match/${match.slug}`} className="block">
                <TeamLine match={match} side="home" />
                <div className="my-1 h-px bg-hairline" />
                <TeamLine match={match} side="away" />
              </Link>
            ) : (
              <Placeholder />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchCard({ match, cellRef }: { match: Match | null; cellRef: (el: HTMLElement | null) => void }) {
  if (!match) {
    return (
      <div ref={cellRef} className="rounded-tile border border-dashed border-hairline bg-card-2 p-1.5">
        <Placeholder />
      </div>
    );
  }
  return (
    <Link
      ref={cellRef}
      href={`/match/${match.slug}`}
      className="block rounded-tile border border-hairline bg-card-2 p-1.5 transition-colors hover:border-white/15"
    >
      <TeamLine match={match} side="home" />
      <div className="my-1 h-px bg-hairline" />
      <TeamLine match={match} side="away" />
    </Link>
  );
}

/** Two empty rows for a tie whose teams aren't decided yet. */
function Placeholder() {
  return (
    <div className="text-[11px] text-text-muted">
      <div className="flex items-center gap-1.5 py-0.5">
        <span className="h-[14px] w-[14px] shrink-0 rounded-full bg-white/5" />
        <span className="flex-1 truncate">TBD</span>
      </div>
      <div className="my-1 h-px bg-hairline" />
      <div className="flex items-center gap-1.5 py-0.5">
        <span className="h-[14px] w-[14px] shrink-0 rounded-full bg-white/5" />
        <span className="flex-1 truncate">TBD</span>
      </div>
    </div>
  );
}

function TeamLine({ match, side }: { match: Match; side: "home" | "away" }) {
  const team = side === "home" ? match.homeTeam : match.awayTeam;
  const score = side === "home" ? match.homeScore : match.awayScore;
  const other = side === "home" ? match.awayScore : match.homeScore;
  const played = score != null && other != null;
  const win = played && score > other;
  return (
    <div className="flex items-center gap-1.5">
      <Crest src={team?.crest} name={team?.name ?? "TBD"} size={14} />
      <span className={`min-w-0 flex-1 truncate text-[11px] ${win ? "font-bold text-text-primary" : "text-text-secondary"}`}>
        {team?.name ?? "TBD"}
      </span>
      <span className={`tabular w-3 shrink-0 text-right text-[11px] ${win ? "font-bold text-text-primary" : "text-text-secondary"}`}>
        {score ?? ""}
      </span>
    </div>
  );
}
