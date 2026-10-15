import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarShell } from "@/components/calendar/CalendarShell";
import { isValidDateKey, todayKey, shiftDateKey, formatLongDate } from "@/lib/utils/date";
import { buildMetadata } from "@/lib/seo/metadata";
import { provider } from "@/lib/providers";

export const dynamic = "force-dynamic";

/** Resolve "today" | "yesterday" | "tomorrow" | YYYY-MM-DD to a date key. */
function resolveDate(param: string): string | null {
  const today = todayKey();
  if (param === "today") return today;
  if (param === "yesterday") return shiftDateKey(today, -1);
  if (param === "tomorrow") return shiftDateKey(today, 1);
  if (isValidDateKey(param)) return param;
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  const key = resolveDate(date);
  if (!key) notFound(); // real 404 for nonsense dates (metadata is blocking)
  const label = formatLongDate(key);
  // Saved fixture lists: no provider request. A day with nothing in our
  // competitions is a thin page — keep it out of the index (the calendar's
  // prev/next links otherwise lead crawlers into endless empty dates).
  const games = await provider.getFixturesByDate(key).catch(() => []);
  const relative = date === "today" ? "today" : date === "tomorrow" ? "tomorrow" : date === "yesterday" ? "yesterday" : null;
  return buildMetadata({
    title: relative
      ? `Football matches ${relative} (${label}): fixtures, kick-off times & scores`
      : `Football fixtures & results: ${label}`,
    absoluteTitle: true,
    description: games.length
      ? `${games.length} matches on ${label} across the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League and MLS: kick-off times, live scores and results.`
      : `No matches in the competitions we cover on ${label}. See the nearest matchdays for fixtures, kick-off times and results.`,
    path: `/matches/${date}`,
    ...(games.length ? {} : { robots: { index: false, follow: true } }),
  });
}

export default async function MatchesByDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const key = resolveDate(date);
  if (!key) notFound();
  return <CalendarShell dateKey={key} />;
}
