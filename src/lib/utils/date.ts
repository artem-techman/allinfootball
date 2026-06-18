/**
 * Date helpers. Everything is stored/transported as UTC ISO 8601; all date math
 * is done in UTC; rendering happens in the user's timezone (default
 * Europe/London). See CLAUDE.md section 3.
 */

export const DEFAULT_TZ = "Europe/London";

/** YYYY-MM-DD for a Date, in the given timezone (used for fixture-by-date keys). */
export function toDateKey(date: Date, timeZone: string = DEFAULT_TZ): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function todayKey(timeZone: string = DEFAULT_TZ): string {
  return toDateKey(new Date(), timeZone);
}

/** Shift a YYYY-MM-DD key by N days (UTC math, safe across DST). */
export function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Validate a YYYY-MM-DD string. */
export function isValidDateKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

/** Render kickoff time (e.g. "5:30 PM") in the user's timezone. */
export function formatKickoffTime(iso: string, timeZone: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

/** Render a short date (e.g. "Sat 17 Jun") in the user's timezone. */
export function formatShortDate(iso: string, timeZone: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));
}

/** Render a YYYY-MM-DD key as a long date, e.g. "Wednesday, 18 June 2026". */
export function formatLongDate(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Relative "time ago" for news meta (e.g. "3h ago"). */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Greeting bucket by hour-of-day in the user's timezone (section 7). */
export function greetingFor(date: Date = new Date(), timeZone: string = DEFAULT_TZ): string {
  const hourStr = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  }).format(date);
  const hour = Number(hourStr);
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
