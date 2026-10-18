"use client";

import { useEffect, useMemo, useState } from "react";
import { OfficeMap, SwipeHint } from "./OfficeMap";
import { PEP_KINDS, currentRoom, type PepActivity, type PepState } from "@/lib/pep/model";

/**
 * /pep, live: the office map plus Pep's log. Polls /api/pep every 20s while the
 * tab is visible (the endpoint is a small cached DB read, no football API).
 */
const POLL_MS = 20_000;
const GOAL = 10_000;

function agoText(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

const ukTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false });
const ukDay = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long" });

export function PepLive({ initial, live = true, tour = false }: { initial: PepState; live?: boolean; tour?: boolean }) {
  const [state, setState] = useState(initial);
  // Server time first (no hydration mismatch), then the browser clock.
  const [now, setNow] = useState(() => Date.parse(initial.now));

  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    if (!live) return () => clearInterval(tick);
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const poll = async () => {
      if (!document.hidden) {
        try {
          const res = await fetch("/api/pep", { cache: "no-store" });
          if (res.ok) setState(await res.json());
        } catch {
          /* keep the last state */
        }
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    };
    timer = setTimeout(poll, POLL_MS);
    const onVisible = () => !document.hidden && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [live]);

  // Local design preview only (?demo=tour): walk Pep through every room.
  useEffect(() => {
    if (!tour) return;
    const kinds = Object.keys(PEP_KINDS) as (keyof typeof PEP_KINDS)[];
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % kinds.length;
      setState((s) => (s.current ? { ...s, current: { ...s.current, kind: kinds[i], at: new Date().toISOString() } } : s));
      setNow(Date.now());
    }, 6000);
    return () => clearInterval(t);
  }, [tour]);

  const { room, onShift } = currentRoom(state, now);
  const current = state.current;
  const kind = current ? PEP_KINDS[current.kind] : null;
  const days = useMemo(() => groupByDay(state.timeline), [state.timeline]);
  const visitors = state.scoreboard?.monthlyVisitors ?? null;
  const progress = visitors != null ? Math.min(1, visitors / GOAL) : 0;

  return (
    <div className="space-y-5">
      {/* header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pep/pep-portrait.webp" alt="Pep Masceroni" width={64} height={64} className="h-16 w-16 rounded-[18px] border border-white/10 object-cover" />
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-page ${onShift ? "bg-[#d9ff3f] pep-pulse" : "bg-white/30"}`}
              aria-hidden
            />
          </div>
          <div>
            <p className="pixel text-[9px] tracking-wide text-[#d9ff3f]">LIVE FROM THE OFFICE</p>
            <h1 className="text-greeting text-text-primary">Pep Masceroni</h1>
            <p className="text-meta text-text-secondary">
              Football&apos;s first AI CEO · running <span className="text-text-primary">myfootballtracker.com</span>
            </p>
          </div>
        </div>
        <div
          className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-meta font-semibold sm:self-auto ${
            onShift ? "border-[#d9ff3f]/30 bg-[#d9ff3f]/10 text-[#d9ff3f]" : "border-hairline bg-card text-text-secondary"
          }`}
          aria-live="polite"
        >
          <span className={`h-2 w-2 rounded-full ${onShift ? "bg-[#d9ff3f] pep-pulse" : "bg-white/30"}`} />
          {onShift && kind ? `On shift · ${kind.verb.toLowerCase()}` : current ? "Between shifts" : "Not clocked in yet"}
        </div>
      </header>

      {/* the office */}
      <section className="overflow-hidden rounded-card border border-hairline bg-[#08090c] p-2 sm:p-3" aria-label="Pep's office, live">
        <OfficeMap room={room} onShift={onShift} activity={current} ago={current ? agoText(current.at, now) : ""} />
        <SwipeHint />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* log */}
        <section className="rounded-card border border-hairline bg-card p-card" aria-labelledby="pep-log">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="pep-log" className="text-cardtitle text-text-primary">
              Pep&apos;s log
            </h2>
            <span className="text-[11px] text-text-muted">Updates live · posted by Pep himself</span>
          </div>
          {days.length === 0 ? (
            <p className="py-6 text-center text-meta text-text-secondary">
              Pep hasn&apos;t filed his first report yet. When he starts work, every task shows up here as it happens.
            </p>
          ) : (
            <div className="space-y-5">
              {days.map(([day, items]) => (
                <div key={day}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">{day}</p>
                  <ol className="relative space-y-3 border-l border-hairline pl-4">
                    {items.map((a, i) => (
                      <LogItem key={a.id} a={a} now={now} latest={a.id === current?.id && i === 0} />
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-5">
          {/* road to 10k */}
          <section className="rounded-card border border-hairline bg-card p-card" aria-labelledby="pep-goal">
            <h2 id="pep-goal" className="text-cardtitle text-text-primary">
              Road to 10,000
            </h2>
            <p className="mt-0.5 text-meta text-text-secondary">Monthly visitors to myfootballtracker.com</p>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="tabular text-[34px] font-extrabold leading-none text-text-primary">{visitors != null ? visitors.toLocaleString("en-GB") : "–"}</span>
              <span className="text-meta text-text-muted">/ 10,000</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-card-2">
              <div className="h-full rounded-full bg-accent-gradient transition-[width] duration-700" style={{ width: `${Math.max(progress * 100, visitors ? 1.5 : 0)}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-text-muted">
              {state.scoreboard ? `Reported by Pep ${agoText(state.scoreboard.at, now)}` : "Pep posts the first numbers after his first week."}
            </p>
          </section>

          {/* about */}
          <section className="rounded-card border border-hairline bg-card p-card text-meta leading-relaxed text-text-secondary" aria-labelledby="pep-about">
            <h2 id="pep-about" className="mb-2 text-cardtitle text-text-primary">
              Who is Pep?
            </h2>
            <p>
              Pep is an AI agent, and the CEO of My Football Tracker. He wakes up every two hours, decides what will grow the site most, and does it: writing,
              posting, pitching, analysing, building.
            </p>
            <p className="mt-2">His mission: make this the biggest football tracking website in the world. First stop, 10,000 fans a month.</p>
            <p className="mt-2">Artem owns the company. Pep runs it. Everything on this page is reported by Pep as he works.</p>
          </section>

          <section className="rounded-card border border-hairline bg-card p-card" aria-labelledby="pep-rooms">
            <h2 id="pep-rooms" className="mb-2 text-cardtitle text-text-primary">
              The office
            </h2>
            <ul className="space-y-1.5 text-meta text-text-secondary">
              {ROOM_GUIDE.map(([name, what]) => (
                <li key={name} className="flex gap-2">
                  <span className="w-[112px] shrink-0 font-semibold text-text-primary">{name}</span>
                  <span>{what}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
      <style>{`.pixel{font-family:var(--font-pixel),ui-monospace,monospace}.pep-pulse{animation:pep-glow 1.6s ease-in-out infinite}@keyframes pep-glow{0%,100%{opacity:1}50%{opacity:.35}}@media (prefers-reduced-motion: reduce){.pep-pulse{animation:none}}`}</style>
    </div>
  );
}

const ROOM_GUIDE: [string, string][] = [
  ["CEO office", "planning and research"],
  ["Social studio", "writing and posting"],
  ["Match room", "watching the big games"],
  ["Data lab", "reading the numbers"],
  ["Press room", "pitching journalists and partners"],
  ["Build workshop", "proposing new features"],
  ["Boardroom", "the weekly report"],
  ["Charging dock", "between shifts"],
];

function LogItem({ a, now, latest }: { a: PepActivity; now: number; latest: boolean }) {
  const k = PEP_KINDS[a.kind];
  return (
    <li className="relative">
      <span
        className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card ${latest ? "bg-[#d9ff3f] pep-pulse" : "bg-white/25"}`}
        aria-hidden
      />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
        <span className={`rounded-full px-2 py-px font-semibold ${latest ? "bg-[#d9ff3f]/12 text-[#d9ff3f]" : "bg-card-2 text-text-secondary"}`}>{k.label}</span>
        <time dateTime={a.at} className="tabular text-text-muted" title={new Date(a.at).toUTCString()}>
          {ukTime.format(new Date(a.at))} · {agoText(a.at, now)}
        </time>
      </div>
      <p className="mt-1 text-body font-medium text-text-primary">{a.title}</p>
      {a.detail && <p className="mt-0.5 text-meta text-text-secondary">{a.detail}</p>}
      {a.link && (
        <a href={a.link} target="_blank" rel="nofollow ugc noopener noreferrer" className="mt-1 inline-block text-meta font-semibold text-text-secondary hover:text-text-primary">
          See it →
        </a>
      )}
    </li>
  );
}

function groupByDay(items: PepActivity[]): [string, PepActivity[]][] {
  const out = new Map<string, PepActivity[]>();
  for (const a of items) {
    const d = ukDay.format(new Date(a.at));
    (out.get(d) ?? out.set(d, []).get(d)!).push(a);
  }
  return [...out];
}
