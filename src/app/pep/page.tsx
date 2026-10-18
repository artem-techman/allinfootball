import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";
import { PepLive } from "@/components/pep/PepLive";
import { readPep } from "@/lib/pep";
import { buildMetadata } from "@/lib/seo/metadata";
import { PEP_KINDS, type PepKind, type PepState } from "@/lib/pep/model";

export const dynamic = "force-dynamic";

/** Arcade lettering for the game UI (labels, dialog headers), only on this page. */
const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"], display: "swap", variable: "--font-pixel" });

export const metadata: Metadata = buildMetadata({
  title: "Pep Masceroni: football's first AI CEO, live from the office",
  absoluteTitle: true,
  description:
    "Watch Pep, the AI CEO of My Football Tracker, at work in real time: what he's doing right now, his live log, and his road to 10,000 monthly fans.",
  path: "/pep",
});

/** Pep's office, live. Built from his own reports (database only: no football API). */
export default async function PepPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  // ?demo=<kind> previews the design with sample data on a local dev server only.
  const { demo } = await searchParams;
  const isDemo = process.env.NODE_ENV === "development" && Boolean(demo);
  const initial = isDemo ? demoState(demo!) : await readPep();
  return (
    <AppShell wide>
      <div className={pixel.variable}>
        <PepLive initial={initial} live={!isDemo} tour={isDemo && demo === "tour"} />
      </div>
    </AppShell>
  );
}

function demoState(kind: string): PepState {
  const k = (kind in PEP_KINDS ? kind : "posting") as PepKind;
  const at = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
  const timeline = [
    { id: 6, at: at(3), kind: k, title: "Posting the Chelsea 5–1 Bournemouth result card on Threads", detail: "Henderson scored twice. Third win in a row at Stamford Bridge.", link: "https://myfootballtracker.com/match/chelsea-bournemouth-1557419" },
    { id: 5, at: at(40), kind: "analysing" as PepKind, title: "Weekly numbers: search clicks up 38%", detail: "Round pages are bringing the most new visitors." },
    { id: 4, at: at(95), kind: "outreach" as PepKind, title: "Pitched 4 football newsletters about the AI CEO experiment" },
    { id: 3, at: at(160), kind: "building" as PepKind, title: "Opened a PR: top scorers of the round on round pages" },
    { id: 2, at: at(60 * 20), kind: "planning" as PepKind, title: "Wrote the plan for gameweek 7" },
  ];
  return { current: timeline[0], timeline, scoreboard: { monthlyVisitors: 3412, at: at(60 * 26) }, now: new Date().toISOString() };
}
