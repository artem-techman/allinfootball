/**
 * Pep Masceroni, the AI CEO, reports what he's doing; /pep draws him in the
 * office room that matches. Pure (no I/O): validation + the kind → room map,
 * shared by the API route, the page and the tests.
 */

export type PepRoom = "strategy" | "match" | "analytics" | "studio" | "lobby" | "press" | "workshop" | "boardroom";

export const PEP_KINDS = {
  planning: { room: "strategy", label: "Planning", verb: "Planning" },
  researching: { room: "strategy", label: "Research", verb: "Researching" },
  writing: { room: "studio", label: "Writing", verb: "Writing" },
  posting: { room: "studio", label: "Posting", verb: "Posting" },
  watching: { room: "match", label: "Match watch", verb: "Watching" },
  analysing: { room: "analytics", label: "Analysis", verb: "Analysing" },
  outreach: { room: "press", label: "Outreach", verb: "Pitching" },
  building: { room: "workshop", label: "Building", verb: "Building" },
  reporting: { room: "boardroom", label: "Report", verb: "Reporting" },
  resting: { room: "lobby", label: "Recharging", verb: "Recharging" },
} as const satisfies Record<string, { room: PepRoom; label: string; verb: string }>;

export type PepKind = keyof typeof PEP_KINDS;

export interface PepActivity {
  id: number;
  at: string; // ISO
  kind: PepKind;
  title: string;
  detail?: string;
  link?: string;
}

export interface PepState {
  current: PepActivity | null;
  timeline: PepActivity[];
  scoreboard: { monthlyVisitors: number; at: string } | null;
  /** Server clock when this was read (so "x minutes ago" is consistent). */
  now: string;
}

/** Pep wakes every 2 hours; past this, he's shown recharging between shifts. */
export const SHIFT_GAP_MS = 150 * 60_000;

/** Where links in Pep's posts may point (his work, never arbitrary sites). */
const LINK_HOSTS = [
  "myfootballtracker.com", "threads.net", "threads.com", "bsky.app", "x.com", "twitter.com", "linkedin.com",
  "reddit.com", "youtube.com", "tiktok.com", "instagram.com", "t.me", "github.com", "producthunt.com",
  "news.ycombinator.com", "indiehackers.com",
];

const clean = (s: unknown, max: number): string | undefined => {
  if (typeof s !== "string") return undefined;
  // Strip control characters and collapse whitespace; React escapes the rest on render.
  const t = s.replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, " ").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : undefined;
};

export function safeLink(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return undefined;
    const host = u.hostname.replace(/^www\./, "");
    return LINK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)) ? u.toString().slice(0, 500) : undefined;
  } catch {
    return undefined;
  }
}

export type StatusInput =
  | { ok: true; activity: { kind: PepKind; title: string; detail?: string; link?: string }; monthlyVisitors?: number }
  | { ok: false; error: string };

/** Validate a status report from Pep. Exported for tests. */
export function parseStatus(body: unknown): StatusInput {
  if (!body || typeof body !== "object") return { ok: false, error: "body must be a JSON object" };
  const b = body as Record<string, unknown>;
  const kind = typeof b.kind === "string" ? b.kind : "";
  if (!(kind in PEP_KINDS)) return { ok: false, error: `kind must be one of: ${Object.keys(PEP_KINDS).join(", ")}` };
  const title = clean(b.title, 140);
  if (!title || title.length < 3) return { ok: false, error: "title is required (3–140 characters)" };
  if (b.link != null && !safeLink(b.link)) return { ok: false, error: "link must be an https URL on our site or a known social platform" };
  let monthlyVisitors: number | undefined;
  if (b.monthlyVisitors != null) {
    const n = Number(b.monthlyVisitors);
    if (!Number.isInteger(n) || n < 0 || n > 100_000_000) return { ok: false, error: "monthlyVisitors must be a whole number" };
    monthlyVisitors = n;
  }
  return {
    ok: true,
    activity: { kind: kind as PepKind, title, detail: clean(b.detail, 500), link: safeLink(b.link) },
    monthlyVisitors,
  };
}

/** Where Pep is standing right now: his latest activity's room, or the lobby dock between shifts. */
export function currentRoom(state: Pick<PepState, "current">, now: number): { room: PepRoom; onShift: boolean } {
  const c = state.current;
  if (!c) return { room: "lobby", onShift: false };
  const fresh = now - Date.parse(c.at) < SHIFT_GAP_MS;
  if (!fresh || c.kind === "resting") return { room: "lobby", onShift: false };
  return { room: PEP_KINDS[c.kind].room, onShift: true };
}
