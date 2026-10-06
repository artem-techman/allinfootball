import { useEffect, useSyncExternalStore } from "react";
import type { Match } from "@/lib/providers/types";
import { mergeLive } from "@/lib/utils/match";

/**
 * ONE shared /api/live polling loop for every Live Now widget on the page (B14).
 * The home page mounts LiveNowRail twice (right rail on desktop, main column on
 * mobile, one of them CSS-hidden); each used to run its own loop, doubling the
 * load per visitor. Now every mounted widget subscribes to this module-level
 * store: the loop starts with the first subscriber and stops when the last one
 * unmounts, keeping its last-known state for the next page.
 *
 * Kept from the per-widget loop: the MONOTONIC merge (mergeLive — the clock and
 * score never rewind, an ended match can't bounce back), hidden tabs don't poll
 * (resumes with an immediate refresh on foreground), the adaptive cadence, and
 * the goal-celebration trigger. Subscribing never restarts the loop, so no
 * render can turn into a fetch.
 */

const LIVE_POLL_MS = 30_000; // while a match is live (matches the server's 30s live TTL)
const NEAR_KICKOFF_POLL_MS = 20_000; // around the next kickoff, to catch it going live
const IDLE_POLL_MS = 5 * 60_000; // nothing live and the next match is a while away
const NEAR_KICKOFF_WINDOW_MS = 2 * 60_000; // "around kickoff" threshold
const CELEBRATE_MS = 1800;

export interface LiveFeedState {
  /** In-play matches, merged monotonically; null until the first response. */
  matches: Match[] | null;
  /** Soonest upcoming fixture (from the server), for the "Up next" countdown on
   *  pages that don't pass their own. */
  next: Match | null;
  /** The server has no API key (keyless demo): widgets may show their preview data. */
  noKey: boolean;
  /** Last response was degraded or failed: show the "may be delayed" banner. */
  degraded: boolean;
  /** Goal-celebration key (a timestamp) while a celebration plays; null when idle. */
  celebrate: number | null;
}

const INITIAL: LiveFeedState = { matches: null, next: null, noKey: false, degraded: false, celebrate: null };

const isInPlay = (m: Match) => m.status === "live" || m.status === "ht";

let state: LiveFeedState = INITIAL;
const listeners = new Set<() => void>();
/** Each widget's "next kickoff" (for the near-kickoff cadence), keyed per mount. */
const kickoffs = new Map<symbol, string>();
/** Bumped on every start/stop so a response from a previous loop is dropped. */
let generation = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let celebrateTimer: ReturnType<typeof setTimeout> | null = null;
// Merge memory across polls (see mergeLive); reset when the loop stops.
let shown: Match[] | null = null;
const lastSeen = new Map<number, Match>();
const ended = new Set<number>();
let prevScores = new Map<number, { home: number; away: number }>();

function update(patch: Partial<LiveFeedState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

/**
 * Compare each live match's score to the previous poll; if ANY side scored,
 * trigger the widget-wide goal celebration (the first poll just records a
 * baseline so existing scores don't celebrate on load).
 */
function detectGoals(incoming: Match[], gen: number) {
  const next = new Map<number, { home: number; away: number }>();
  let scored = false;
  for (const m of incoming.filter(isInPlay)) {
    const h = m.homeScore ?? 0;
    const a = m.awayScore ?? 0;
    const prev = prevScores.get(m.id);
    if (prev && (h > prev.home || a > prev.away)) scored = true;
    next.set(m.id, { home: h, away: a });
  }
  prevScores = next; // also prunes matches that are no longer live
  if (!scored) return;
  update({ celebrate: Date.now() });
  if (celebrateTimer) clearTimeout(celebrateTimer);
  celebrateTimer = setTimeout(() => {
    if (gen === generation) update({ celebrate: null });
  }, CELEBRATE_MS);
}

function scheduleNext(gen: number, anyLive: boolean) {
  if (gen !== generation) return;
  let delay = IDLE_POLL_MS;
  if (anyLive) {
    delay = LIVE_POLL_MS;
  } else if (kickoffs.size > 0) {
    const soonest = Math.min(...[...kickoffs.values()].map((iso) => new Date(iso).getTime()));
    delay = soonest - Date.now() <= NEAR_KICKOFF_WINDOW_MS ? NEAR_KICKOFF_POLL_MS : IDLE_POLL_MS;
  }
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => tick(gen), delay);
}

async function tick(gen: number) {
  if (gen !== generation) return;
  // Hidden tabs don't poll: a backgrounded tab left open all day was a big
  // slice of the 2026-07-10 quota burn. The visibilitychange listener resumes
  // (with an immediate refresh) when the tab is foregrounded.
  if (typeof document !== "undefined" && document.hidden) return;
  try {
    const res = await fetch("/api/live", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { matches: Match[]; next?: Match | null; delayed?: boolean; reason?: string };
    if (gen !== generation) return;
    const merged = mergeLive(
      shown,
      (data.matches ?? []).filter(isInPlay),
      lastSeen,
      ended,
      // A degraded response (provider error / stale snapshot) can't prove a
      // match has ended, so it may only add or advance, never remove.
      !data.delayed,
    );
    shown = merged;
    update({
      matches: merged,
      next: data.next ?? state.next,
      noKey: data.reason === "no_key",
      degraded: Boolean(data.delayed) && data.reason !== "no_key",
    });
    detectGoals(merged, gen);
    scheduleNext(gen, merged.length > 0);
  } catch {
    if (gen !== generation) return;
    // Keep last-good real data; never fake it.
    update({ degraded: true, noKey: false, matches: state.matches ?? [] });
    scheduleNext(gen, false);
  }
}

function onVisibilityChange() {
  if (document.hidden) return;
  if (timer) clearTimeout(timer);
  tick(generation);
}

function start() {
  generation += 1;
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibilityChange);
  tick(generation);
}

function stop() {
  generation += 1;
  if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibilityChange);
  if (timer) clearTimeout(timer);
  if (celebrateTimer) clearTimeout(celebrateTimer);
  timer = celebrateTimer = null;
  // Keep what we know. Navigating between pages unmounts one widget and mounts
  // the next; wiping the state here made every page switch start from an empty
  // skeleton. The next start() shows the last-known list at once and refreshes
  // it immediately (the merge memory keeps it monotonic).
  if (state.celebrate != null) state = { ...state, celebrate: null };
}

/** Stable (module-level) subscribe, as useSyncExternalStore needs. Exported for tests. */
export function subscribeLiveFeed(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

export function getLiveFeedSnapshot(): LiveFeedState {
  return state;
}

/** Server render and hydration always start from the empty (skeleton) state. */
function getServerSnapshot(): LiveFeedState {
  return INITIAL;
}

/**
 * Read the shared live feed. `nextKickoff` (ISO) lets the loop speed up around
 * this widget's next fixture; changing it doesn't restart the loop.
 */
export function useLiveFeed(nextKickoff?: string): LiveFeedState {
  const feed = useSyncExternalStore(subscribeLiveFeed, getLiveFeedSnapshot, getServerSnapshot);
  useEffect(() => {
    if (!nextKickoff) return;
    const id = Symbol("live-feed-kickoff");
    kickoffs.set(id, nextKickoff);
    return () => {
      kickoffs.delete(id);
    };
  }, [nextKickoff]);
  return feed;
}
