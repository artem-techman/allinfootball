import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarShell } from "@/components/calendar/CalendarShell";
import { isValidDateKey, todayKey, shiftDateKey, formatLongDate } from "@/lib/utils/date";

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
  const label = key ? formatLongDate(key) : "Matches";
  return {
    title: `Matches — ${label}`,
    description: `Football fixtures and results for ${label} across the nine competitions on All In Football.`,
    alternates: { canonical: `/matches/${date}` },
  };
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
