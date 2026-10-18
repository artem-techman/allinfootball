"use client";

import { useEffect, useRef, useState } from "react";
import type { PepActivity, PepRoom } from "@/lib/pep/model";
import { PEP_KINDS } from "@/lib/pep/model";

/**
 * Pep's office as a little game: a pixel-art map (public/pep/office.webp,
 * generated with Higgsfield) with Pep walking the corridors between rooms.
 *
 * Coordinates are in the map's 2000×1116 design space and placed in %, so the
 * scene scales with any width. Pep moves along a walk graph (corridors and
 * doorways traced over the artwork) using the shortest path, one leg at a
 * time, with a 4-direction walk cycle from public/pep/pep-sprite.webp
 * (rows: down, left, right, up × 4 frames).
 */

const MW = 2000;
const MH = 1116;
const pct = (x: number, y: number) => ({ left: `${(x / MW) * 100}%`, top: `${(y / MH) * 100}%` });

type Dir = "down" | "left" | "right" | "up";
const ROW: Record<Dir, number> = { down: 0, left: 1, right: 2, up: 3 };

/* ------------------------------- walk graph ------------------------------- */

const NODES = {
  H_ceo: [375, 560], H_studio: [548, 560], H_match: [1000, 560], H_lab: [1480, 560],
  ceo_door: [375, 470], ceo: [375, 350],
  match_door: [1000, 470], match_in: [1000, 415], match_side: [850, 415], match: [850, 300],
  lab_door: [1480, 470], lab_in: [1480, 385], lab_mid: [1660, 385], lab: [1660, 268],
  studio_door: [548, 700], studio_in: [548, 790], studio: [300, 790],
  lobby_in: [1000, 625], lobby_r: [1100, 625], lobby_r2: [1100, 738], dock: [1168, 738],
  board_door: [1000, 760], board_in: [1000, 832], board: [770, 832],
  side: [1480, 690], press_door: [1600, 690], press: [1760, 652],
  work_door: [1478, 860], work_in: [1478, 950], work: [1790, 962],
} as const satisfies Record<string, readonly [number, number]>;
export type NodeId = keyof typeof NODES;

const EDGES: [NodeId, NodeId][] = [
  ["H_ceo", "H_studio"], ["H_studio", "H_match"], ["H_match", "H_lab"],
  ["H_ceo", "ceo_door"], ["ceo_door", "ceo"],
  ["H_match", "match_door"], ["match_door", "match_in"], ["match_in", "match_side"], ["match_side", "match"],
  ["H_lab", "lab_door"], ["lab_door", "lab_in"], ["lab_in", "lab_mid"], ["lab_mid", "lab"],
  ["H_studio", "studio_door"], ["studio_door", "studio_in"], ["studio_in", "studio"],
  ["H_match", "lobby_in"], ["lobby_in", "lobby_r"], ["lobby_r", "lobby_r2"], ["lobby_r2", "dock"],
  ["lobby_in", "board_door"], ["board_door", "board_in"], ["board_in", "board"],
  ["H_lab", "side"], ["side", "press_door"], ["press_door", "press"],
  ["side", "work_door"], ["work_door", "work_in"], ["work_in", "work"],
];

const dist = (a: NodeId, b: NodeId) => Math.hypot(NODES[a][0] - NODES[b][0], NODES[a][1] - NODES[b][1]);

/** Shortest path (Dijkstra; the graph is tiny). Exported for tests. */
export function findPath(from: NodeId, to: NodeId): NodeId[] {
  if (from === to) return [from];
  const adj = new Map<NodeId, NodeId[]>();
  for (const [a, b] of EDGES) {
    adj.set(a, [...(adj.get(a) ?? []), b]);
    adj.set(b, [...(adj.get(b) ?? []), a]);
  }
  const best = new Map<NodeId, number>([[from, 0]]);
  const prev = new Map<NodeId, NodeId>();
  const open = new Set<NodeId>([from]);
  while (open.size) {
    let cur: NodeId | undefined;
    for (const n of open) if (cur === undefined || best.get(n)! < best.get(cur)!) cur = n;
    open.delete(cur!);
    if (cur === to) break;
    for (const nb of adj.get(cur!) ?? []) {
      const d = best.get(cur!)! + dist(cur!, nb);
      if (d < (best.get(nb) ?? Infinity)) {
        best.set(nb, d);
        prev.set(nb, cur!);
        open.add(nb);
      }
    }
  }
  const out: NodeId[] = [to];
  while (out[0] !== from) {
    const p = prev.get(out[0]);
    if (!p) return [from, to];
    out.unshift(p);
  }
  return out;
}

/* --------------------------------- rooms ---------------------------------- */

interface RoomDef {
  name: string;
  spot: NodeId;
  /** Which way Pep faces while working there. */
  face: Dir;
  /** Label position (top-left inside the room). */
  label: [number, number];
}

export const ROOMS: Record<PepRoom, RoomDef> = {
  strategy: { name: "CEO office", spot: "ceo", face: "up", label: [78, 66] },
  match: { name: "Match room", spot: "match", face: "up", label: [740, 66] },
  analytics: { name: "Data lab", spot: "lab", face: "up", label: [1374, 66] },
  studio: { name: "Social studio", spot: "studio", face: "down", label: [78, 632] },
  lobby: { name: "Charging dock", spot: "dock", face: "down", label: [740, 614] },
  boardroom: { name: "Boardroom", spot: "board", face: "down", label: [706, 816] },
  press: { name: "Press room", spot: "press", face: "down", label: [1626, 470] },
  workshop: { name: "Build workshop", spot: "work", face: "up", label: [1372, 816] },
};

const SPEED = 230; // design units per second
const FRAME_MS = 140;

function dirBetween(a: readonly [number, number], b: readonly [number, number]): Dir {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

/* --------------------------------- scene ---------------------------------- */

export function OfficeMap({
  room,
  onShift,
  activity,
  ago,
}: {
  room: PepRoom;
  onShift: boolean;
  activity: PepActivity | null;
  ago: string;
}) {
  const start = ROOMS[room].spot;
  const [node, setNode] = useState<NodeId>(start); // where Pep is drawn (or heading)
  const [legMs, setLegMs] = useState(0);
  const [dir, setDir] = useState<Dir>(ROOMS[room].face);
  const [walking, setWalking] = useState(false);
  const [frame, setFrame] = useState(0);
  const at = useRef<NodeId>(start); // last node actually reached
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Walk to the new room along the corridors.
  useEffect(() => {
    const target = ROOMS[room].spot;
    if (at.current === target) {
      setDir(ROOMS[room].face);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      at.current = target;
      setLegMs(0);
      setNode(target);
      setDir(ROOMS[room].face);
      return;
    }
    const path = findPath(at.current, target);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let i = 1;
    setWalking(true);
    const step = () => {
      if (cancelled) return;
      if (i >= path.length) {
        setWalking(false);
        setDir(ROOMS[room].face);
        return;
      }
      const from = path[i - 1];
      const to = path[i];
      const ms = Math.max(140, (dist(from, to) / SPEED) * 1000);
      setDir(dirBetween(NODES[from], NODES[to]));
      setLegMs(ms);
      setNode(to);
      timer = setTimeout(() => {
        at.current = to;
        i += 1;
        step();
      }, ms);
    };
    step();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [room]);

  // Walk cycle.
  useEffect(() => {
    if (!walking) {
      setFrame(0);
      return;
    }
    const t = setInterval(() => setFrame((f) => (f + 1) % 4), FRAME_MS);
    return () => clearInterval(t);
  }, [walking]);

  // Phones see part of the office: keep Pep in view (jump on load, glide after).
  const firstScroll = useRef(true);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const x = Math.max(0, (NODES[ROOMS[room].spot][0] / MW) * el.scrollWidth - el.clientWidth / 2);
    if (firstScroll.current) el.scrollLeft = x;
    else el.scrollTo({ left: x, behavior: "smooth" });
    firstScroll.current = false;
  }, [room]);

  const [x, y] = NODES[node];
  const kind = activity ? PEP_KINDS[activity.kind] : null;
  const sleeping = !onShift && !walking;
  const text = onShift && activity ? activity.title : activity ? "Recharging between shifts" : "Hasn't clocked in yet";
  // Top-row rooms: the dialog box goes under Pep so it doesn't leave the map.
  const below = NODES[ROOMS[room].spot][1] < 420;

  return (
    <div ref={scrollerRef} className="overflow-x-auto overflow-y-hidden [scrollbar-width:none]">
      <div className="relative min-w-[760px] select-none overflow-hidden rounded-[10px] lg:min-w-0" style={{ aspectRatio: `${MW} / ${MH}` }}>
        {/* the world */}
        <picture>
          <source media="(max-width: 900px)" srcSet="/pep/office-sm.webp" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pep/office.webp" alt="" className="absolute inset-0 h-full w-full" draggable={false} />
        </picture>

        {/* room labels */}
        {(Object.keys(ROOMS) as PepRoom[]).map((id) => {
          const r = ROOMS[id];
          const active = id === room;
          return (
            <span
              key={id}
              className={`pixel absolute z-[1] rounded-[3px] px-1.5 py-1 text-[clamp(6px,0.62vw,9px)] leading-none tracking-wide shadow-[0_2px_0_rgba(0,0,0,0.6)] ${
                active ? "bg-[#d9ff3f] text-[#0b0d11]" : "bg-black/70 text-white/80"
              }`}
              style={pct(r.label[0], r.label[1])}
            >
              {r.name.toUpperCase()}
            </span>
          );
        })}

        {/* Pep */}
        <div
          className="absolute z-10 w-[5%]"
          style={{
            ...pct(x, y),
            transform: "translate(-50%, -94%)",
            transition: legMs ? `left ${legMs}ms linear, top ${legMs}ms linear` : undefined,
          }}
        >
          {/* dialog box */}
          <div
            className={`pointer-events-none absolute left-1/2 w-[clamp(180px,18vw,250px)] -translate-x-1/2 ${
              below ? "top-[calc(100%+20px)]" : "bottom-[calc(100%+8px)]"
            }`}
          >
            <div className="rpg-box px-3 py-2">
              <div className="mb-1 flex items-center gap-2">
                <span className={`pixel text-[8px] leading-none ${onShift ? "text-[#d9ff3f]" : "text-white/60"}`}>
                  {onShift && kind ? kind.verb.toUpperCase() : "OFF SHIFT"}
                </span>
                {ago && <span className="ml-auto text-[10px] font-medium text-white/50">{ago}</span>}
              </div>
              <p className="line-clamp-2 text-[12px] font-semibold leading-snug text-white">{text}</p>
            </div>
          </div>

          <span className="absolute bottom-[1%] left-1/2 h-[9%] w-[78%] -translate-x-1/2 rounded-[50%] bg-black/55 blur-[1px]" aria-hidden />
          <div
            className={`relative ${walking ? "" : onShift ? "pep-breathe" : ""} ${sleeping ? "brightness-[0.8]" : ""}`}
            style={{
              aspectRatio: "120 / 192",
              backgroundImage: "url(/pep/pep-sprite.webp)",
              backgroundSize: "400% 400%",
              backgroundPosition: `${(walking ? frame : 0) * 33.3333}% ${ROW[dir] * 33.3333}%`,
              filter: "drop-shadow(0 0 4px rgba(217,255,63,0.28))",
            }}
            role="img"
            aria-label="Pep, the AI CEO"
          />
          {sleeping && (
            <span className="pixel pep-zzz pointer-events-none absolute -right-3 top-[8%] text-[9px] text-[#d9ff3f]" aria-hidden>
              Zz
            </span>
          )}
          <span className="pixel absolute left-1/2 top-[101%] -translate-x-1/2 whitespace-nowrap rounded-[3px] bg-[#0b0d11]/85 px-1.5 py-0.5 text-[7px] leading-none text-[#d9ff3f]">
            PEP
          </span>
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );
}

/** Phones see part of the office at a time. */
export function SwipeHint() {
  return <p className="pixel mt-2 text-center text-[8px] text-text-muted lg:hidden">SWIPE TO LOOK AROUND</p>;
}

const CSS = `
.pixel { font-family: var(--font-pixel), ui-monospace, monospace; }
.rpg-box {
  background: rgba(11,13,17,0.94);
  border: 2px solid #d9ff3f;
  border-radius: 4px;
  box-shadow: 0 0 0 2px #0b0d11, 0 4px 0 2px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.06);
}
@keyframes pep-breathe { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2%) } }
@keyframes pep-z { 0% { opacity: 0; transform: translate(0,0) } 30% { opacity: 1 } 100% { opacity: 0; transform: translate(8px,-14px) } }
.pep-breathe { animation: pep-breathe 2.4s ease-in-out infinite }
.pep-zzz { animation: pep-z 2.4s ease-out infinite }
@media (prefers-reduced-motion: reduce) { .pep-breathe, .pep-zzz { animation: none } }
`;
