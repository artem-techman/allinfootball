"use client";

import { useEffect, useRef, useState } from "react";
import type { PepActivity, PepRoom } from "@/lib/pep/model";
import { PEP_KINDS } from "@/lib/pep/model";

/**
 * The My Football Tracker office, drawn as a 2D floor plan, with Pep walking
 * between rooms. Coordinates live in a 1200×760 plan; Pep is an HTML sprite
 * positioned in % of that plan, so he moves smoothly at any width. He walks
 * the corridor (down to the hallway, along it, up into the room) instead of
 * gliding through walls.
 */

const W = 1200;
const H = 760;
const HALL_Y = 350; // the corridor between the two rows of rooms

interface RoomDef {
  id: PepRoom;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Where Pep stands while working here. */
  spot: [number, number];
}

export const ROOMS: RoomDef[] = [
  { id: "strategy", name: "CEO office", x: 40, y: 40, w: 360, h: 290, spot: [220, 236] },
  { id: "match", name: "Match room", x: 420, y: 40, w: 360, h: 290, spot: [600, 262] },
  { id: "analytics", name: "Data lab", x: 800, y: 40, w: 360, h: 290, spot: [980, 236] },
  { id: "studio", name: "Social studio", x: 40, y: 370, w: 360, h: 350, spot: [196, 560] },
  { id: "lobby", name: "Lobby · charging dock", x: 420, y: 370, w: 360, h: 160, spot: [690, 470] },
  { id: "boardroom", name: "Boardroom", x: 420, y: 550, w: 360, h: 170, spot: [470, 650] },
  { id: "press", name: "Press room", x: 800, y: 370, w: 360, h: 160, spot: [930, 470] },
  { id: "workshop", name: "Build workshop", x: 800, y: 550, w: 360, h: 170, spot: [960, 668] },
];
const roomById = (id: PepRoom) => ROOMS.find((r) => r.id === id)!;

const pct = (x: number, y: number) => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` });

/** Each room's door is mid-wall on the hallway side (the boardroom and workshop
 *  open into the lobby and press room above them, on the same line). */
const doorX = (id: PepRoom) => {
  const r = roomById(id);
  return r.x + r.w / 2;
};

/** Corridor route between rooms: to the door, out to the hallway, along it, in through the next door. */
function route(fromRoom: PepRoom, from: [number, number], toRoom: PepRoom): [number, number][] {
  const to = roomById(toRoom).spot;
  if (fromRoom === toRoom) return from[0] === to[0] && from[1] === to[1] ? [] : [to];
  const a = doorX(fromRoom);
  const b = doorX(toRoom);
  // Stacked rooms on one door line (lobby ↔ boardroom, press ↔ workshop): straight through, no hallway detour.
  const sameLine = a === b && from[1] > HALL_Y && to[1] > HALL_Y;
  const pts: [number, number][] = sameLine ? [[a, from[1]], [b, to[1]], to] : [[a, from[1]], [a, HALL_Y], [b, HALL_Y], [b, to[1]], to];
  // Drop zero-length legs.
  return pts.filter((p, i) => {
    const prev = i === 0 ? from : pts[i - 1];
    return p[0] !== prev[0] || p[1] !== prev[1];
  });
}

const SPEED = 260; // plan units per second

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
  const [pos, setPos] = useState<[number, number]>(roomById(room).spot);
  const [legMs, setLegMs] = useState(0);
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<1 | -1>(1);
  const posRef = useRef(pos);
  const roomRef = useRef(room);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Walk to the new room whenever it changes.
  useEffect(() => {
    const target = roomById(room).spot;
    const legs = route(roomRef.current, posRef.current, room);
    roomRef.current = room;
    if (!legs.length) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      posRef.current = target;
      setLegMs(0);
      setPos(target);
      return;
    }
    setWalking(true);
    let prev = posRef.current;
    for (const leg of legs) {
      const dist = Math.hypot(leg[0] - prev[0], leg[1] - prev[1]);
      const ms = Math.max(120, (dist / SPEED) * 1000);
      const from = prev;
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          if (leg[0] !== from[0]) setFacing(leg[0] > from[0] ? 1 : -1);
          setLegMs(ms);
          posRef.current = leg;
          setPos(leg);
        }, elapsed),
      );
      elapsed += ms;
      prev = leg;
    }
    timers.push(setTimeout(() => !cancelled && setWalking(false), elapsed));
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [room]);

  // On narrow screens the plan scrolls sideways: keep Pep in view (jump on
  // load, glide after that).
  const firstScroll = useRef(true);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const x = Math.max(0, (roomById(room).spot[0] / W) * el.scrollWidth - el.clientWidth / 2);
    if (firstScroll.current) el.scrollLeft = x;
    else el.scrollTo({ left: x, behavior: "smooth" });
    firstScroll.current = false;
  }, [room]);

  const kind = activity ? PEP_KINDS[activity.kind] : null;
  const bubbleBelow = roomById(room).spot[1] < HALL_Y;
  const bubble = onShift && activity ? activity.title : activity ? "Recharging between shifts" : "Pep hasn't clocked in yet";

  return (
    <div ref={scrollerRef} className="overflow-x-auto overflow-y-hidden rounded-card [scrollbar-width:none]">
      <div className="relative min-w-[720px]" style={{ aspectRatio: `${W} / ${H}` }}>
        <PlanSvg active={room} onShift={onShift} />

        {/* Pep */}
        <div
          className="absolute z-10 w-[5.2%] -translate-x-1/2 -translate-y-[88%]"
          style={{ ...pct(pos[0], pos[1]), transition: `left ${legMs}ms linear, top ${legMs}ms linear` }}
        >
          {/* status bubble: above Pep, or below him in the top-row rooms so it never hides the room */}
          <div
            className={`pointer-events-none absolute left-1/2 w-[clamp(180px,22vw,260px)] -translate-x-1/2 ${
              bubbleBelow ? "top-[calc(100%+22px)]" : "bottom-[calc(100%+6px)]"
            }`}
          >
            <div className="rounded-[12px] border border-white/10 bg-[#0f1116]/95 px-3 py-2 shadow-elevated backdrop-blur">
              <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]">
                <span className={`h-1.5 w-1.5 rounded-full ${onShift ? "bg-[#d9ff3f] pep-pulse" : "bg-white/30"}`} />
                <span className={onShift ? "text-[#d9ff3f]" : "text-text-muted"}>{onShift && kind ? kind.verb : "Off shift"}</span>
                {ago && <span className="ml-auto font-medium normal-case tracking-normal text-text-muted">{ago}</span>}
              </div>
              <p className="line-clamp-2 text-[12px] font-medium leading-snug text-white">{bubble}</p>
            </div>
            <span
              className={`absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-white/10 bg-[#0f1116] ${
                bubbleBelow ? "bottom-full translate-y-1 border-l border-t" : "top-full -translate-y-1 border-b border-r"
              }`}
            />
          </div>
          <PepSprite walking={walking} working={onShift && !walking} sleeping={!onShift && !walking} facing={facing} />
          <span className="absolute left-1/2 top-[102%] -translate-x-1/2 whitespace-nowrap rounded-full bg-accent-gradient px-1.5 py-px text-[9px] font-bold text-[#0a0b0d]">
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
  return <p className="mt-2 text-center text-[11px] text-text-muted md:hidden">Swipe to look around the office</p>;
}

/* --------------------------------- sprite --------------------------------- */

export function PepSprite({ walking, working, sleeping, facing = 1 }: { walking: boolean; working: boolean; sleeping: boolean; facing?: 1 | -1 }) {
  return (
    <div className={`relative ${walking ? "pep-walk" : working ? "pep-work" : "pep-idle"}`} style={{ transform: `scaleX(${facing})` }}>
      <svg viewBox="0 0 64 80" className="block w-full overflow-visible" aria-label="Pep, the AI CEO" role="img">
        <ellipse cx="32" cy="76" rx="15" ry="3.5" fill="#000" opacity="0.45" />
        {/* legs */}
        <rect className="pep-leg-l" x="23" y="58" width="7" height="15" rx="3.5" fill="#181b21" />
        <rect className="pep-leg-r" x="34" y="58" width="7" height="15" rx="3.5" fill="#181b21" />
        <rect x="21.5" y="70" width="10" height="4.5" rx="2.2" fill="#d9ff3f" />
        <rect x="32.5" y="70" width="10" height="4.5" rx="2.2" fill="#d9ff3f" />
        {/* arms */}
        <rect className="pep-arm-l" x="10" y="38" width="8" height="18" rx="4" fill="#1c8a47" />
        <rect className="pep-arm-r" x="46" y="38" width="8" height="18" rx="4" fill="#1c8a47" />
        {/* tracksuit */}
        <rect x="16" y="35" width="32" height="27" rx="11" fill="#23a455" />
        <path d="M16 46h32" stroke="#5bc850" strokeWidth="2" opacity="0.6" />
        <rect x="31" y="37" width="2" height="23" rx="1" fill="#d9ff3f" />
        <path d="M25 35l7 6 7-6" fill="none" stroke="#f1f4f7" strokeWidth="2.4" strokeLinejoin="round" />
        {/* head */}
        <line x1="32" y1="7" x2="32" y2="1.5" stroke="#c9ced6" strokeWidth="2" />
        <circle className="pep-antenna" cx="32" cy="1.8" r="2.6" fill="#d9ff3f" />
        <rect x="11" y="6" width="42" height="31" rx="13" fill="#eef1f5" />
        <rect x="11" y="6" width="42" height="31" rx="13" fill="url(#pepShine)" />
        <rect x="16" y="13" width="32" height="16" rx="8" fill="#0b0d11" />
        <g className={sleeping ? "pep-eyes-sleep" : "pep-eyes"}>
          <rect x="22" y="17.5" width="6" height="6" rx="3" fill="#d9ff3f" />
          <rect x="36" y="17.5" width="6" height="6" rx="3" fill="#d9ff3f" />
        </g>
        <defs>
          <linearGradient id="pepShine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="1" stopColor="#c9ced6" stopOpacity="0.4" />
          </linearGradient>
        </defs>
      </svg>
      {sleeping && (
        <span className="pep-zzz pointer-events-none absolute -right-1 -top-2 text-[10px] font-bold text-[#d9ff3f]" aria-hidden>
          z z
        </span>
      )}
    </div>
  );
}

/* ------------------------------- floor plan ------------------------------- */

const WALL = "rgba(255,255,255,0.09)";
const FURN = "#1b1e25";
const FURN_2 = "#232731";
const EDGE = "rgba(255,255,255,0.07)";
const LIME = "#d9ff3f";
const GREEN = "#23a455";

function PlanSvg({ active, onShift }: { active: PepRoom; onShift: boolean }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <pattern id="tiles" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="1" />
        </pattern>
        <pattern id="planks" width="60" height="16" patternUnits="userSpaceOnUse">
          <rect width="60" height="16" fill="#14171d" />
          <path d="M0 15.5H60M30 0V16" stroke="rgba(255,255,255,0.035)" />
        </pattern>
        <radialGradient id="activeGlow" cx="50%" cy="50%" r="65%">
          <stop offset="0" stopColor={LIME} stopOpacity="0.10" />
          <stop offset="1" stopColor={LIME} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={GREEN} />
          <stop offset="0.5" stopColor="#5bc850" />
          <stop offset="1" stopColor={LIME} />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* building */}
      <rect x="10" y="10" width={W - 20} height={H - 20} rx="30" fill="#0a0c10" stroke={WALL} strokeWidth="2" />
      <rect x="10" y="10" width={W - 20} height={H - 20} rx="30" fill="url(#tiles)" />
      {/* hallway runner */}
      <rect x="40" y={HALL_Y - 9} width="1120" height="18" rx="9" fill="rgba(35,164,85,0.06)" />
      <path d={`M60 ${HALL_Y}H1140`} stroke="rgba(217,255,63,0.10)" strokeWidth="2" strokeDasharray="2 14" strokeLinecap="round" />

      {ROOMS.map((r) => (
        <Room key={r.id} r={r} active={active === r.id} />
      ))}

      <CeoOffice />
      <MatchRoom live={active === "match" && onShift} />
      <DataLab live={active === "analytics" && onShift} />
      <Studio live={active === "studio" && onShift} />
      <Lobby charging={active === "lobby"} />
      <Boardroom live={active === "boardroom" && onShift} />
      <PressRoom />
      <Workshop live={active === "workshop" && onShift} />

      {/* entrance */}
      <rect x="560" y={H - 22} width="80" height="12" rx="6" fill="#0a0c10" />
      <path d={`M565 ${H - 16}h70`} stroke={LIME} strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Room({ r, active }: { r: RoomDef; active: boolean }) {
  return (
    <g>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="18" fill="url(#planks)" />
      {active && <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="18" fill="url(#activeGlow)" />}
      <rect
        x={r.x}
        y={r.y}
        width={r.w}
        height={r.h}
        rx="18"
        fill="none"
        stroke={active ? LIME : WALL}
        strokeOpacity={active ? 0.55 : 1}
        strokeWidth={active ? 2 : 1.5}
        className={active ? "pep-room-active" : undefined}
      />
      {/* door gap facing the hallway */}
      <rect x={r.x + r.w / 2 - 26} y={r.y < HALL_Y ? r.y + r.h - 2 : r.y - 2} width="52" height="4" fill="#0a0c10" />
      <g transform={`translate(${r.x + 16} ${r.y + 16})`}>
        <rect width={r.name.length * 7.4 + 22} height="22" rx="11" fill={active ? "rgba(217,255,63,0.12)" : "rgba(255,255,255,0.04)"} />
        <circle cx="11" cy="11" r="3" fill={active ? LIME : "rgba(255,255,255,0.25)"} />
        <text x="20" y="15" fontSize="11" fontWeight="600" letterSpacing="0.06em" fill={active ? LIME : "#878d97"}>
          {r.name.toUpperCase()}
        </text>
      </g>
    </g>
  );
}

const Plant = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <circle r="15" fill="#123a22" />
    <circle cx="-6" cy="-4" r="8" fill="#1f6b3a" />
    <circle cx="6" cy="-3" r="7" fill="#23a455" />
    <circle cx="0" cy="6" r="7" fill="#1c8a47" />
    <circle cx="2" cy="-8" r="4" fill="#5bc850" />
  </g>
);

const Chair = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r="11" fill={FURN_2} stroke={EDGE} />
    <circle r="6" fill="#2b303b" />
  </g>
);

function CeoOffice() {
  return (
    <g>
      {/* bookshelf */}
      <rect x="230" y="52" width="156" height="20" rx="5" fill={FURN} stroke={EDGE} />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
        <rect key={i} x={236 + i * 13.5} y="56" width="9" height="12" rx="2" fill={["#23a455", "#2b303b", "#5a38ff", "#d9ff3f", "#3a3f4b"][i % 5]} opacity="0.75" />
      ))}
      {/* 10K goal poster */}
      <rect x="60" y="80" width="88" height="56" rx="8" fill="#101216" stroke="rgba(217,255,63,0.35)" />
      <text x="104" y="114" textAnchor="middle" fontSize="22" fontWeight="800" fill="url(#brand)">10K</text>
      <text x="104" y="128" textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#878d97" letterSpacing="0.1em">THE GOAL</text>
      {/* rug + desk */}
      <rect x="120" y="150" width="200" height="140" rx="20" fill="rgba(35,164,85,0.07)" stroke="rgba(35,164,85,0.15)" />
      <rect x="140" y="160" width="160" height="56" rx="10" fill={FURN_2} stroke={EDGE} />
      <rect x="196" y="166" width="48" height="26" rx="4" fill="#0b0d11" stroke="rgba(217,255,63,0.4)" />
      <path d="M202 176h22M202 182h30M202 187h16" stroke={LIME} strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round" />
      <rect x="152" y="194" width="30" height="14" rx="3" fill="#2b303b" />
      <circle cx="276" cy="198" r="7" fill="#2b303b" />
      <circle cx="276" cy="198" r="3" fill="#7a5a3a" />
      <Chair x={220} y={252} />
      <Plant x={372} y={300} />
      <Plant x={66} y={300} s={0.85} />
    </g>
  );
}

function MatchRoom({ live }: { live: boolean }) {
  return (
    <g>
      {/* big screen with a pitch */}
      <rect x="470" y="70" width="260" height="96" rx="10" fill="#0b0d11" stroke={live ? "rgba(217,255,63,0.6)" : EDGE} strokeWidth="2" />
      {live && <rect x="470" y="70" width="260" height="96" rx="10" fill={LIME} opacity="0.12" filter="url(#glow)" />}
      <rect x="480" y="80" width="240" height="76" rx="5" fill="#123821" />
      <g stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" fill="none">
        <rect x="486" y="86" width="228" height="64" rx="2" />
        <path d="M600 86v64" />
        <circle cx="600" cy="118" r="12" />
        <rect x="486" y="104" width="18" height="28" />
        <rect x="696" y="104" width="18" height="28" />
      </g>
      <circle className={live ? "pep-ball" : undefined} cx="612" cy="112" r="3" fill="#fff" />
      <rect x="560" y="60" width="80" height="16" rx="8" fill={live ? "#ef4444" : "#2b303b"} />
      <text x="600" y="71.5" textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff" letterSpacing="0.12em">{live ? "● LIVE" : "MATCH TV"}</text>
      {/* sofa + table */}
      <rect x="520" y="276" width="160" height="40" rx="14" fill="#2a2f3a" stroke={EDGE} />
      <rect x="530" y="266" width="140" height="22" rx="10" fill="#323846" />
      <rect x="560" y="214" width="80" height="26" rx="8" fill={FURN} stroke={EDGE} />
      <circle cx="580" cy="227" r="5" fill="#d9ff3f" opacity="0.8" />
      <circle cx="616" cy="227" r="4" fill="#ef4444" opacity="0.7" />
      {/* scarf */}
      <path d="M440 120c14 10 14 30 0 44" stroke={GREEN} strokeWidth="7" strokeLinecap="round" fill="none" strokeDasharray="7 5" />
      <Plant x={758} y={300} s={0.85} />
    </g>
  );
}

function DataLab({ live }: { live: boolean }) {
  const bars = [24, 38, 30, 52, 46, 64, 58, 78];
  return (
    <g>
      {/* wall of screens */}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={830 + i * 104} y="66" width="96" height="62" rx="7" fill="#0b0d11" stroke={live ? "rgba(217,255,63,0.45)" : EDGE} />
      ))}
      {bars.map((h, i) => (
        <rect key={i} className={live ? "pep-bar" : undefined} style={{ animationDelay: `${i * 90}ms` }} x={840 + i * 10} y={120 - h * 0.6} width="6" height={h * 0.6} rx="1.5" fill={i === bars.length - 1 ? LIME : GREEN} opacity={i === bars.length - 1 ? 1 : 0.75} />
      ))}
      <polyline points="944,116 960,104 976,108 992,92 1008,96 1024,80" fill="none" stroke={LIME} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="1024" cy="80" r="3" fill={LIME} />
      <circle cx="1088" cy="97" r="20" fill="none" stroke="#2b303b" strokeWidth="8" />
      <circle cx="1088" cy="97" r="20" fill="none" stroke={LIME} strokeWidth="8" strokeDasharray="44 126" transform="rotate(-90 1088 97)" />
      <text x="1088" y="101" textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff">10K</text>
      {/* standing desk + whiteboard */}
      <rect x="920" y="158" width="120" height="40" rx="9" fill={FURN_2} stroke={EDGE} />
      <rect x="954" y="164" width="52" height="18" rx="3" fill="#0b0d11" />
      <rect x="1080" y="150" width="60" height="150" rx="8" fill="#e9edf2" opacity="0.08" stroke={EDGE} />
      <path d="M1092 180l14 16 18-26M1092 230h36M1092 246h26M1092 262h32" stroke="rgba(255,255,255,0.35)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <Plant x={826} y={300} s={0.85} />
    </g>
  );
}

function Studio({ live }: { live: boolean }) {
  return (
    <g>
      {/* backdrop with the brand */}
      <rect x="64" y="414" width="300" height="70" rx="12" fill="#101216" stroke={EDGE} />
      <path d="M118 434c-8 0-14 6-14 14 0 10 14 22 14 22s14-12 14-22c0-8-6-14-14-14z" fill="url(#brand)" />
      <circle cx="118" cy="447" r="5" fill="#101216" />
      <text x="142" y="447" fontSize="13" fontWeight="800" fill="#fff">MY FOOTBALL</text>
      <text x="142" y="463" fontSize="13" fontWeight="800" fill="url(#brand)">TRACKER</text>
      {/* on air */}
      <rect x="290" y="428" width="60" height="18" rx="9" fill={live ? "#ef4444" : "#2b303b"} />
      <text x="320" y="440.5" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#fff" letterSpacing="0.12em">ON AIR</text>
      {/* ring light + phone */}
      <circle cx="268" cy="560" r="30" fill="none" stroke={LIME} strokeOpacity={live ? 0.9 : 0.35} strokeWidth="6" />
      {live && <circle cx="268" cy="560" r="30" fill="none" stroke={LIME} strokeWidth="10" opacity="0.35" filter="url(#glow)" />}
      <rect x="260" y="546" width="16" height="28" rx="4" fill="#0b0d11" stroke="rgba(255,255,255,0.3)" />
      <path d="M268 590v40M256 640l12-10 12 10" stroke="#3a3f4b" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* desk with mic + laptop */}
      <rect x="110" y="590" width="130" height="48" rx="10" fill={FURN_2} stroke={EDGE} />
      <rect x="128" y="598" width="44" height="28" rx="4" fill="#0b0d11" stroke="rgba(217,255,63,0.35)" />
      <circle cx="210" cy="610" r="7" fill="#3a3f4b" />
      <path d="M210 617v14" stroke="#3a3f4b" strokeWidth="3" />
      {/* social glyphs floating */}
      <g opacity={live ? 1 : 0.35} className={live ? "pep-float" : undefined}>
        <circle cx="330" cy="520" r="12" fill="#1a1d24" stroke={EDGE} />
        <text x="330" y="524.5" textAnchor="middle" fontSize="12" fill="#fff">@</text>
        <circle cx="350" cy="600" r="12" fill="#1a1d24" stroke={EDGE} />
        <path d="M344 600l4 4 8-8" stroke={LIME} strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="326" cy="660" r="12" fill="#1a1d24" stroke={EDGE} />
        <path d="M321 659h10M326 654v10" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
      </g>
      <Plant x={66} y={696} />
    </g>
  );
}

function Lobby({ charging }: { charging: boolean }) {
  return (
    <g>
      {/* pitch rug */}
      <rect x="470" y="410" width="170" height="100" rx="14" fill="#123821" opacity="0.85" />
      <g stroke="rgba(255,255,255,0.28)" strokeWidth="1.3" fill="none">
        <rect x="480" y="420" width="150" height="80" rx="4" />
        <path d="M555 420v80" />
        <circle cx="555" cy="460" r="14" />
      </g>
      <path d="M555 444c-6 0-10 4-10 10 0 7 10 15 10 15s10-8 10-15c0-6-4-10-10-10z" fill="url(#brand)" />
      {/* charging dock */}
      <rect x="664" y="452" width="52" height="40" rx="12" fill="#101216" stroke={charging ? "rgba(217,255,63,0.7)" : EDGE} strokeWidth="1.5" />
      {charging && <rect x="664" y="452" width="52" height="40" rx="12" fill={LIME} opacity="0.18" filter="url(#glow)" className="pep-pulse" />}
      <path d="M692 458l-8 14h7l-3 12 9-16h-7z" fill={LIME} opacity={charging ? 1 : 0.4} />
      <text x="690" y="506" textAnchor="middle" fontSize="8" fontWeight="700" fill="#878d97" letterSpacing="0.1em">DOCK</text>
      <Plant x={756} y={410} s={0.8} />
    </g>
  );
}

function Boardroom({ live }: { live: boolean }) {
  return (
    <g>
      <rect x="500" y="618" width="230" height="56" rx="26" fill={FURN_2} stroke={EDGE} />
      {[530, 580, 630, 680].map((x) => (
        <g key={x}>
          <Chair x={x} y={604} />
          <Chair x={x} y={690} />
        </g>
      ))}
      <rect x="748" y="600" width="12" height="90" rx="4" fill="#0b0d11" stroke={live ? "rgba(217,255,63,0.6)" : EDGE} />
      <text x="615" y="650" textAnchor="middle" fontSize="9" fontWeight="700" fill={live ? LIME : "#878d97"} letterSpacing="0.12em">WEEKLY REPORT</text>
    </g>
  );
}

function PressRoom() {
  return (
    <g>
      {/* mail wall */}
      {[0, 1, 2, 3, 4].map((i) =>
        [0, 1].map((j) => <rect key={`${i}-${j}`} x={1030 + i * 24} y={400 + j * 22} width="20" height="18" rx="3" fill={FURN} stroke={EDGE} />),
      )}
      <rect x="1056" y="404" width="12" height="9" rx="1.5" fill="#e9edf2" opacity="0.8" />
      <path d="M1056 404l6 5 6-5" stroke="#878d97" fill="none" />
      {/* desk with envelopes + newspaper */}
      <rect x="880" y="470" width="130" height="44" rx="10" fill={FURN_2} stroke={EDGE} />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${958 + i * 4} ${478 + i * 4})`}>
          <rect width="30" height="20" rx="2" fill="#e9edf2" opacity={0.6 + i * 0.15} />
          <path d="M0 0l15 11 15-11" stroke="#878d97" fill="none" />
        </g>
      ))}
      <rect x="896" y="478" width="40" height="26" rx="2" fill="#2b303b" />
      <path d="M902 486h28M902 492h22M902 498h26" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
      <rect x="1088" y="468" width="56" height="18" rx="9" fill="rgba(217,255,63,0.1)" />
      <text x="1116" y="480.5" textAnchor="middle" fontSize="8.5" fontWeight="800" fill={LIME} letterSpacing="0.12em">PRESS</text>
    </g>
  );
}

function Workshop({ live }: { live: boolean }) {
  return (
    <g>
      <rect x="880" y="606" width="200" height="40" rx="9" fill={FURN_2} stroke={EDGE} />
      <rect x="930" y="586" width="64" height="38" rx="5" fill="#0b0d11" stroke={live ? "rgba(217,255,63,0.55)" : EDGE} />
      <path d="M938 596h20M944 603h30M944 610h22M938 617h14" stroke={LIME} strokeOpacity={live ? 0.9 : 0.35} strokeWidth="2" strokeLinecap="round" />
      {/* branch glyph: pull request */}
      <g transform="translate(1104 600)" stroke={LIME} strokeOpacity={live ? 1 : 0.45} strokeWidth="2.5" fill="none">
        <circle cx="0" cy="0" r="5" />
        <circle cx="0" cy="40" r="5" />
        <circle cx="26" cy="40" r="5" />
        <path d="M0 5v30M26 35V18c0-6-4-10-10-10H9" />
      </g>
      {/* toolbox */}
      <rect x="836" y="664" width="42" height="26" rx="5" fill="#5a38ff" opacity="0.55" />
      <rect x="848" y="658" width="18" height="8" rx="3" fill="none" stroke="#5a38ff" strokeOpacity="0.7" strokeWidth="2.5" />
    </g>
  );
}

const CSS = `
@keyframes pep-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2.5%) } }
@keyframes pep-step { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6%) } }
@keyframes pep-swing { 0%,100% { transform: rotate(10deg) } 50% { transform: rotate(-10deg) } }
@keyframes pep-type { 0%,100% { transform: translateY(0) } 50% { transform: translateY(5%) } }
@keyframes pep-blink { 0%,92%,100% { transform: scaleY(1) } 95% { transform: scaleY(0.1) } }
@keyframes pep-glow { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }
@keyframes pep-z { 0% { opacity: 0; transform: translate(0,0) } 30% { opacity: 1 } 100% { opacity: 0; transform: translate(6px,-12px) } }
@keyframes pep-bar { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(0.75) } }
@keyframes pep-roll { 0% { transform: translate(0,0) } 25% { transform: translate(40px,10px) } 50% { transform: translate(-30px,18px) } 75% { transform: translate(-50px,-6px) } 100% { transform: translate(0,0) } }
@keyframes pep-float-k { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
@keyframes pep-room { 0%,100% { stroke-opacity: 0.55 } 50% { stroke-opacity: 0.25 } }
.pep-idle svg { animation: pep-bob 3.2s ease-in-out infinite }
.pep-walk svg { animation: pep-step 0.36s ease-in-out infinite }
.pep-walk .pep-arm-l, .pep-walk .pep-leg-r { transform-box: fill-box; transform-origin: top; animation: pep-swing 0.36s ease-in-out infinite }
.pep-walk .pep-arm-r, .pep-walk .pep-leg-l { transform-box: fill-box; transform-origin: top; animation: pep-swing 0.36s ease-in-out infinite reverse }
.pep-work .pep-arm-l, .pep-work .pep-arm-r { transform-box: fill-box; animation: pep-type 0.5s ease-in-out infinite }
.pep-work .pep-arm-r { animation-delay: 0.25s }
.pep-work svg { animation: pep-bob 2.4s ease-in-out infinite }
.pep-eyes { transform-box: fill-box; transform-origin: center; animation: pep-blink 4s infinite }
.pep-eyes-sleep { transform-box: fill-box; transform-origin: center; transform: scaleY(0.18) }
.pep-antenna, .pep-pulse { animation: pep-glow 1.6s ease-in-out infinite }
.pep-zzz { animation: pep-z 2.4s ease-out infinite }
.pep-bar { transform-box: fill-box; transform-origin: bottom; animation: pep-bar 1.4s ease-in-out infinite }
.pep-ball { animation: pep-roll 6s ease-in-out infinite }
.pep-float { animation: pep-float-k 3s ease-in-out infinite }
.pep-room-active { animation: pep-room 2.4s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) {
  .pep-idle svg, .pep-walk svg, .pep-work svg, .pep-eyes, .pep-antenna, .pep-pulse, .pep-zzz, .pep-bar, .pep-ball, .pep-float, .pep-room-active,
  .pep-walk .pep-arm-l, .pep-walk .pep-arm-r, .pep-walk .pep-leg-l, .pep-walk .pep-leg-r, .pep-work .pep-arm-l, .pep-work .pep-arm-r { animation: none }
}
`;
