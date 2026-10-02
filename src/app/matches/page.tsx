import type { Metadata } from "next";
import { CalendarShell } from "@/components/calendar/CalendarShell";
import { todayKey } from "@/lib/utils/date";
import { buildMetadata } from "@/lib/seo/metadata";
import { competitionListSentence } from "@/lib/seo/copy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Matches",
  description: `Live scores and fixtures across ${competitionListSentence()}.`,
  path: "/matches",
});

export default function MatchesPage() {
  return <CalendarShell dateKey={todayKey()} />;
}
