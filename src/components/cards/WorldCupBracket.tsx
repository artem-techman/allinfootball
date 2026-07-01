"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { Match } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";
import { TrophyIcon, ChevronRightIcon } from "@/components/primitives/icons";
import { matchWinner, hasShootout } from "@/lib/utils/match";

export interface BracketRound {
  name: string;
  matches: Match[];
}

/**
 * The full knockout skeleton, outermost → Final. We always render every slot of
 * every round (16 → 8 → 4 → 2 → 1) even when the teams aren't known yet, so the
 * shape of the draw is visible from the group stage onward. `name` is the round
 * title shown in the column header; `label` is the European fraction sublabel.
 */
const SKELETON = [
  { name: "Round of 32", label: "1/16", total: 16 },
  { name: "Round of 16", label: "1/8", total: 8 },
  { name: "Quarter-finals", label: "1/4", total: 4 },
  { name: "Semi-finals", label: "1/2", total: 2 },
] as const;

/** Height of the matches area when docked; every column shares it so
 *  justify-around lines each match up with the centre of its two feeders. This
 *  MUST be tall enough for the outermost round's 8 stacked cards (~71px each) to
 *  fit without overflowing — otherwise that column compresses while the inner
 *  rounds spread out, and the pairs stop lining up with their next-round match.
 *  In full screen this grows to fill the viewport. */
const DOCKED_H = 640;

type Cell = { key: string; match: Match | null };
type Column = { name: string; label: string; side: "L" | "R"; round: number; cells: Cell[] };

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
      name: s.name,
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
      name: s.name,
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
    if (sc) {
      const fitsNow = sc.scrollWidth <= sc.clientWidth + 1;
      setFits(fitsNow);
      // When the tree is wider than the viewport we can't flex-centre it. On
      // desktop we scroll-centre on the Final (equal clip on both sides); on
      // mobile we anchor hard left so the first games are visible instead of the
      // empty middle. Runs on every resize — including a sidebar toggle — so it
      // re-positions correctly. ResizeObserver never fires on plain scrolling, so
      // a user's manual horizontal scroll is preserved.
      if (!fitsNow) {
        const mobile = window.matchMedia("(max-width: 820px)").matches;
        sc.scrollLeft = mobile ? 0 : (sc.scrollWidth - sc.clientWidth) / 2;
      }
    }
  }, [rounds]);

  // re-measure connectors after layout, and whenever the size/mode changes
  // (entering full screen remounts the content into a portal).
  useLayoutEffect(() => {
    recompute();
    const content = contentRef.current;
    const scroll = scrollRef.current;
    if (!content) return;
    const ro = new ResizeObserver(recompute);
    ro.observe(content);
    // Also watch the scroll container: when the sidebar toggles, the available
    // width changes (but the w-max content width doesn't), so this is what tells
    // us the bracket now fits and can re-centre.
    if (scroll) ro.observe(scroll);
    return () => ro.disconnect();
  }, [recompute, expanded, areaH]);

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
      setAreaH(Math.max(DOCKED_H, window.innerHeight - 200));
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
      <div ref={contentRef} className="relative flex w-max items-stretch gap-[16px]">
        {/* connector overlay — lime lines behind the cards, in the same coordinate
            space as the content so it scrolls with it */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full text-accent-lime" aria-hidden>
          {paths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeOpacity={0.55} />
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
        className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-page"
        style={{ left: sidebarRight }}
        role="dialog"
        aria-modal="true"
        aria-label="World Cup knockout bracket"
      >
        <StadiumBackdrop />
        <header className="relative flex items-center justify-between border-b border-white/10 px-5 py-4">
          <BrandHeader />
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-[12px] font-semibold text-text-secondary backdrop-blur-sm transition-colors hover:text-text-primary"
          >
            <CloseIcon size={14} /> Close
          </button>
        </header>
        <div className="relative flex min-h-0 flex-1 items-center px-5 py-4">{board}</div>
        <div className="relative pb-4">
          <Legend />
        </div>
      </div>,
      document.body,
    );
  }

  return (
    /* Thin brand-gradient frame; the section itself carries the stadium scene. */
    <div className="mft-gradient-border rounded-card p-[1.5px] shadow-soft">
      <section className="relative overflow-hidden rounded-[15px] bg-page">
        <StadiumBackdrop />
        <div className="relative p-card">
          <header className="mb-5 flex items-start justify-between gap-3">
            <BrandHeader />
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
                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-[12px] font-semibold text-text-secondary backdrop-blur-sm transition-colors hover:text-text-primary"
              >
                <ExpandIcon size={14} /> Full screen
              </button>
            </div>
          </header>

          {board}
          <Legend />
        </div>
      </section>
    </div>
  );
}

/** The dark green stadium scene behind the bracket: image + contrast overlays +
 *  a soft green pitch glow rising from the bottom centre. */
function StadiumBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[url('/wc-bracket-bg.png')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/55" />
      <div className="absolute inset-x-0 bottom-0 top-1/3 bg-[radial-gradient(ellipse_55%_70%_at_50%_100%,rgba(91,200,80,0.20),transparent_70%)]" />
    </div>
  );
}

/** Title block: a glowing green trophy badge + heading. */
function BrandHeader() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 place-items-center rounded-full border border-[rgba(91,200,80,0.5)] bg-accent-lime-soft shadow-[0_0_16px_rgba(91,200,80,0.35)]">
        <TrophyIcon size={20} className="text-accent-lime" />
      </span>
      <div>
        <h2 className="text-section text-text-primary">World Cup Knockouts</h2>
        {/* Hidden on mobile, where horizontal space is tight. */}
        <p className="mt-0.5 hidden text-meta text-text-secondary min-[821px]:block">
          The road to the final — scroll to follow the bracket.
        </p>
      </div>
    </div>
  );
}

/** Bottom legend explaining the card states. */
function Legend() {
  return (
    <div className="relative mt-4 flex items-center justify-center gap-5 text-[11px] text-text-secondary">
      <span className="flex items-center gap-1.5">
        <ShieldIcon className="text-accent-lime" /> Qualified
      </span>
      <span className="flex items-center gap-1.5">
        <ShieldIcon className="text-text-muted" />
        <span className="font-semibold text-text-primary">TBD</span> · To be determined
      </span>
    </div>
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
  // A column whose ties are all undecided only needs room for "TBD", so it's
  // narrowed to keep the whole diagram compact.
  const allTbd = column.cells.every((c) => c.match === null);
  return (
    <div className={`relative z-10 flex shrink-0 flex-col ${allTbd ? "w-[88px]" : "w-[126px]"}`}>
      <div className="mb-3 text-center leading-tight">
        <div className="text-[10px] font-bold uppercase tracking-wider text-text-primary">{column.name}</div>
        <div className="text-[11px] font-bold text-accent-lime">{column.label}</div>
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
    <div className={`relative z-10 flex shrink-0 flex-col ${match ? "w-[150px]" : "w-[120px]"}`}>
      {/* green light beam rising behind the Final */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-full w-[240px] -translate-x-1/2 bg-[radial-gradient(ellipse_42%_55%_at_50%_52%,rgba(91,200,80,0.45),transparent_70%)] blur-md"
      />
      <div className="relative mb-3 flex flex-col items-center gap-1">
        <TrophyIcon size={24} className="text-accent-lime drop-shadow-[0_0_10px_rgba(91,200,80,0.9)]" />
        <span className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-text-primary">Final</span>
      </div>
      <div className="relative flex flex-col justify-around" style={{ height: areaH }}>
        <div
          ref={(el) => register("F", el)}
          className="rounded-[12px] bg-accent-gradient p-[2px] shadow-[0_0_28px_rgba(91,200,80,0.5)]"
        >
          <div className="rounded-[10px] bg-black/75 p-2 backdrop-blur-sm">
            {match ? (
              <Link href={`/match/${match.slug}`} className="block">
                <TeamLine match={match} side="home" />
                <div className="my-1 h-px bg-white/10" />
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
      <div ref={cellRef} className="rounded-[10px] border border-dashed border-white/10 bg-black/30 p-2 backdrop-blur-sm">
        <Placeholder />
      </div>
    );
  }
  return (
    <Link
      ref={cellRef}
      href={`/match/${match.slug}`}
      className="block rounded-[10px] border border-white/10 bg-black/40 p-2 backdrop-blur-sm transition-colors hover:border-[rgba(91,200,80,0.5)]"
    >
      <TeamLine match={match} side="home" />
      <div className="my-1 h-px bg-white/10" />
      <TeamLine match={match} side="away" />
    </Link>
  );
}

/** Two empty rows for a tie whose teams aren't decided yet. */
function Placeholder() {
  return (
    <div className="text-[12px] text-text-muted">
      <div className="flex items-center gap-2 py-0.5">
        <ShieldIcon className="shrink-0 text-text-muted" />
        <span className="flex-1 truncate">TBD</span>
      </div>
      <div className="my-1 h-px bg-white/10" />
      <div className="flex items-center gap-2 py-0.5">
        <ShieldIcon className="shrink-0 text-text-muted" />
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
  // Use the provider's winner so penalty/extra-time wins are highlighted even
  // when regulation finished level (e.g. a 1-1 settled on penalties).
  const win = matchWinner(match) === side;
  const pen = hasShootout(match) ? (side === "home" ? match.homePenalty : match.awayPenalty) : undefined;
  return (
    <div className="flex items-center gap-2 py-0.5">
      <Crest src={team?.crest} name={team?.name ?? "TBD"} size={16} />
      <span className={`min-w-0 flex-1 truncate text-[12px] ${win ? "font-bold text-text-primary" : "text-text-secondary"}`}>
        {team?.name ?? "TBD"}
      </span>
      {pen != null && (
        <span className={`tabular shrink-0 text-[11px] font-bold ${win ? "text-accent-lime" : "text-text-muted"}`}>
          ({pen})
        </span>
      )}
      {played && (
        <span
          className={`tabular min-w-[18px] rounded bg-white/5 px-1 text-center text-[11px] ${
            win ? "font-bold text-text-primary" : "text-text-secondary"
          }`}
        >
          {score}
        </span>
      )}
    </div>
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

function ShieldIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3z" opacity={0.9} />
    </svg>
  );
}
