import type { Metadata } from "next";
import { CalendarShell } from "@/components/calendar/CalendarShell";
import { todayKey } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Matches",
  description: "Live scores and fixtures across the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Europa League, MLS and the FIFA World Cup.",
  alternates: { canonical: "/matches" },
};

export default function MatchesPage() {
  return <CalendarShell dateKey={todayKey()} />;
}
