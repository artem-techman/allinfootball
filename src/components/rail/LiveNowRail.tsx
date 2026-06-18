"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Match } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";
import { Pill } from "@/components/primitives/Pill";
import { Skeleton } from "@/components/primitives/Skeleton";
import { ErrorBanner } from "@/components/primitives/ErrorBanner";
import { ChevronRightIcon } from "@/components/primitives/icons";

/**
 * Live Now rail (dark reference). Title + red LIVE pill. Each live match shows a
 * competition label (logo + name), two team rows (crest + name + score), and a
 * right-aligned status: minute in 42-Lime, "HT" in live-red. Auto-refreshes
 * every 15s WHILE any match is live/ht and stops otherwise. The scores region is
 * aria-live for screen readers.
 *
 * `previewMatches` renders sample fixtures when the API has no live data (e.g.
 * before FOOTBALL_API_KEY is configured) so the rail demonstrates the design.
 */
export function LiveNowRail({ previewMatches = [] }: { previewMatches?: Match[] }) {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { matches: Match[]; delayed?: boolean; reason?: string };
        if (cancelled) return;
        // A real provider degradation (429/5xx) — not just the no-key preview path.
        setDegraded(Boolean(data.delayed) && data.reason !== "no_key");
        // Sample fixtures are ONLY for the keyless demo. With a real key, show the
        // actual live matches — or the empty state when none are in play. Never
        // present placeholders as if they were live.
        if (data.reason === "no_key" && previewMatches.length) {
          setMatches(previewMatches);
          setIsPreview(true);
        } else {
          setMatches(data.matches);
          setIsPreview(false);
        }
        const anyLive = data.matches.some((m) => m.status === "live" || m.status === "ht");
        if (anyLive) timer.current = setTimeout(tick, 15_000);
      } catch {
        if (cancelled) return;
        setDegraded(true);
        setMatches((prev) => prev ?? []); // keep last-good real data; never fake it
        setIsPreview(false);
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [previewMatches]);

  return (
    <section className="rounded-card border border-hairline bg-card p-card">
      <header className="mb-1 flex items-center justify-between">
        <h3 className="text-cardtitle text-text-primary">Live Now</h3>
        <Pill tone="live">
          <span className="mr-1 inline-block h-1.5 w-1.5 animate-live-pulse rounded-full bg-text-on-dark" />
          Live
        </Pill>
      </header>

      {degraded && (
        <div className="mb-2">
          <ErrorBanner />
        </div>
      )}

      <div aria-live="polite" aria-atomic="false">
        {matches === null ? (
          <div className="space-y-3 pt-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : matches.length === 0 ? (
          <p className="py-5 text-center text-meta text-text-secondary">No live matches right now</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {matches.map((m) => (
              <li key={m.id}>
                <Link href={`/match/${m.slug}`} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <Crest src={m.competition?.logo} name={m.competition?.name ?? "Competition"} size={13} />
                      <span className="truncate text-[11px] text-text-muted">{m.competition?.name}</span>
                    </div>
                    <Row name={m.homeTeam?.name ?? "Home"} crest={m.homeTeam?.crest} score={m.homeScore} />
                    <Row name={m.awayTeam?.name ?? "Away"} crest={m.awayTeam?.crest} score={m.awayScore} />
                  </div>
                  <LiveStatus minute={m.minute} status={m.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href="/matches/today"
        className="mt-2 flex items-center justify-center gap-1 border-t border-hairline pt-3 text-meta font-semibold text-text-primary hover:text-accent-lime"
      >
        View all live matches <ChevronRightIcon size={15} />
      </Link>
      {isPreview && <span className="sr-only">Showing sample data</span>}
    </section>
  );
}

function Row({ name, crest, score }: { name: string; crest?: string; score?: number }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <Crest src={crest} name={name} size={18} />
      <span className="min-w-0 flex-1 truncate text-meta text-text-primary">{name}</span>
      <span className="tabular w-4 text-right text-meta font-bold text-text-primary">{score ?? "-"}</span>
    </div>
  );
}

function LiveStatus({ minute, status }: { minute?: number; status: Match["status"] }) {
  if (status === "ht") return <span className="shrink-0 text-meta font-bold text-live-red">HT</span>;
  if (status === "live")
    return (
      <span className="tabular shrink-0 text-meta font-bold text-live-minute">
        {minute != null ? `${minute}'` : "LIVE"}
      </span>
    );
  return <span className="shrink-0 text-meta text-text-secondary">FT</span>;
}
